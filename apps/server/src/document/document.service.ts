import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as Y from 'yjs';
import {
  GetDocumentResponseDto,
  LibraryDocumentDto,
  GetLibraryDocumentsResponseDto,
  SearchLibraryDocumentsResponseDto,
  mapsAreEqual,
} from '@converge/shared';
import { REDIS_EVENTS, REDIS_LOCKS } from '../redis/redis.events';
import { DatabaseService } from '../db/database.service';
import { RedisService } from '../redis/redis.service';
import { uint8ArrayToBase64 } from '../utils/utils';
import { sql } from 'kysely';

@Injectable()
export class DocumentService {
  // In-memory registry of live Y.Doc instances, keyed by document ID.
  // Acts as the source of truth for whether a document is loaded and subscribed.
  private readonly yDocsMap = new Map<number, Y.Doc>();

  /** Number of updates since the last compaction that triggers a new compaction. */
  private readonly COMPACTION_THRESHOLD = 5000;

  /** TTL for the distributed compaction lock in milliseconds. */
  private readonly COMPACTION_LOCK_TTL_MS = 60 * 60 * 1000;

  constructor(
    private readonly dbService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Applies a Yjs update to the shared document and returns the update
   * along with the server's new state vector.
   * @param documentId - the document to apply the update to
   * @param update - encoded Yjs update bytes from the client
   * @returns the applied update and the server state vector after the update
   */
  async applyDocUpdate(
    documentId: number,
    update: Uint8Array,
  ): Promise<{
    update: Uint8Array;
    serverSV: Uint8Array;
  }> {
    const yDoc = await this.loadDoc(documentId);

    // Persist before applying to memory. If the insert fails, the in-memory doc
    // simply misses this update — the repair sync protocol will eventually
    // reconcile the divergence. The reverse (apply then failed insert) is worse:
    // the update would exist in memory but never be persisted, so it would be
    // permanently lost on restart.
    const db = this.dbService.kysely;

    let compactionRequired = false;

    await db.transaction().execute(async (tx) => {
      // Append the raw Yjs update bytes to the persistent update log.
      await tx
        .insertInto('document_updates')
        .values({ update: Buffer.from(update), document_id: documentId })
        .execute();

      // Increment update_count so the compaction logic can detect when the threshold is crossed.
      const updatedRows = await tx
        .updateTable('documents')
        .set({ update_count: sql`update_count + 1` })
        .where('documents.id', '=', documentId)
        .returning(['update_count', 'last_compact_count'])
        .execute();

      if (updatedRows.length > 0) {
        const {
          update_count: updateCount,
          last_compact_count: lastCompactCount,
        } = updatedRows[0];
        if (updateCount >= lastCompactCount + this.COMPACTION_THRESHOLD) {
          compactionRequired = true;
        }
      }
    });

    // apply the update locally
    Y.applyUpdate(yDoc, update);

    // Fire-and-forget compaction check — not awaited so it does not block the write path.
    if (compactionRequired) this.compactUpdatesIfRequired(documentId);

    // Publish to other server instances via Redis pub/sub so their in-memory
    // docs stay in sync. The update is base64-encoded because Uint8Array does
    // not survive JSON.stringify.
    this.redisService.publish(REDIS_EVENTS.documentUpdate(documentId), {
      updateBase64: uint8ArrayToBase64(update),
    });

    // return the update unchanged alongside the new server state vector
    return { update, serverSV: Y.encodeStateVector(yDoc) };
  }

  /**
   * Applies a Yjs update directly to the in-memory doc without persisting to
   * the database or publishing to Redis. Used when receiving updates from other
   * server instances via Redis pub/sub — persistence and publishing were already
   * handled by the originating server.
   * @param documentId - the document to apply the update to
   * @param update - encoded Yjs update bytes
   * @returns the server state vector after the update
   */
  async applyDocUpdateOnlyToLocalMemory(
    documentId: number,
    update: Uint8Array,
  ) {
    const yDoc = await this.loadDoc(documentId);
    Y.applyUpdate(yDoc, update);
    return Y.encodeStateVector(yDoc);
  }

  /**
   * Returns true if the client's state vector matches the server's,
   * indicating the two documents are fully in sync.
   * @param documentId - the document to check sync status for
   * @param clientSV - the client's encoded state vector
   * @returns true if both state vectors are equal entry-for-entry
   */
  async isClientAndServerDocSynced(
    documentId: number,
    clientSV: Uint8Array,
  ): Promise<boolean> {
    const yDoc = await this.loadDoc(documentId);

    // decode both state vectors into Maps and compare them entry-for-entry
    return mapsAreEqual(
      Y.decodeStateVector(Y.encodeStateVector(yDoc)),
      Y.decodeStateVector(clientSV),
    );
  }

  /**
   * Computes the updates the client is missing relative to its state vector
   * and returns them alongside the server's current state vector.
   * @param documentId - the document to compute the diff for
   * @param clientSV - the client's encoded state vector
   * @returns the diff the client needs and the server's current state vector
   */
  async getClientServerDocDiff(
    documentId: number,
    clientSV: Uint8Array,
  ): Promise<{
    diff: Uint8Array;
    serverSV: Uint8Array;
  }> {
    const yDoc = await this.loadDoc(documentId);

    // encode only the updates the client has not yet seen
    const diff = Y.encodeStateAsUpdate(yDoc, clientSV);
    // snapshot the server SV so the client can detect any remaining gaps
    const serverSV = Y.encodeStateVector(yDoc);
    return { diff, serverSV };
  }

  /**
   * Compacts persisted Yjs updates into a single merged blob if the number of
   * updates since the last compaction has crossed the threshold. All updates up
   * to the current max id are merged and replaced atomically within a
   * transaction, so any updates written concurrently are unaffected.
   * Errors are caught internally — a failed compaction is non-fatal and will be
   * retried the next time the threshold is crossed.
   */
  async compactUpdatesIfRequired(documentId: number): Promise<void> {
    let lockAcquired = false;
    try {
      lockAcquired = await this.redisService.acquireLock(
        REDIS_LOCKS.compaction(documentId),
        this.COMPACTION_LOCK_TTL_MS,
      );

      if (!lockAcquired) {
        console.log(
          `compactUpdatesIfRequired: lock already held by another server, skipping for ${documentId}`,
        );
        return;
      }

      const db = this.dbService.kysely;

      await db.transaction().execute(async (tx) => {
        const row = await tx
          .selectFrom('documents')
          .where('documents.id', '=', documentId)
          .select(['update_count', 'last_compact_count'])
          .executeTakeFirst();

        if (row === undefined) {
          console.log(
            `compactUpdatesIfRequired: no documents row found, skipping compaction for ${documentId}`,
          );
          return;
        }

        const {
          update_count: updateCount,
          last_compact_count: lastCompactCount,
        } = row;

        if (updateCount < lastCompactCount + this.COMPACTION_THRESHOLD) return;

        const maxUpdateIdRow = await tx
          .selectFrom('document_updates')
          .where('document_updates.document_id', '=', documentId)
          .select(sql<string | null>`max(id)`.as('maxUpdateId'))
          .executeTakeFirst();

        if (
          maxUpdateIdRow === undefined ||
          maxUpdateIdRow.maxUpdateId === null
        ) {
          console.log(
            'compactUpdatesIfRequired: no updates found, skipping compaction',
          );
          return;
        }

        const maxId = Number(maxUpdateIdRow.maxUpdateId);

        // Fetch all updates up to and including maxId in insertion order.
        const updateRows = await tx
          .selectFrom('document_updates')
          .select('update')
          .where('document_updates.document_id', '=', documentId)
          .where('id', '<=', maxId)
          .orderBy('id', 'asc')
          .execute();

        // Merge into a single Yjs update blob.
        const merged = Y.mergeUpdates(
          updateRows.map((r) => new Uint8Array(r.update)),
        );

        // Insert the merged blob before deleting the originals — if the insert
        // fails the originals are still intact and no data is lost.
        await tx
          .insertInto('document_updates')
          .values({ update: Buffer.from(merged), document_id: documentId })
          .execute();

        // Remove all individual updates that were folded into the merged blob.
        await tx
          .deleteFrom('document_updates')
          .where('id', '<=', maxId)
          .where('document_id', '=', documentId)
          .execute();

        // Record the update_count at the time of compaction so the threshold
        // check is relative to the next batch of updates, not the total count.
        await tx
          .updateTable('documents')
          .set({ last_compact_count: updateCount })
          .where('documents.id', '=', documentId)
          .execute();
      });
    } catch (err) {
      console.error('compactUpdatesIfRequired: compaction failed:', err);
    } finally {
      if (lockAcquired)
        await this.redisService.releaseLock(REDIS_LOCKS.compaction(documentId));
    }
  }

  /**
   * Returns the in-memory Y.Doc for the given document, loading and caching it
   * from the database on first access. Subsequent calls return the cached instance.
   * @param documentId - the document to load
   * @returns the live Y.Doc instance for this document
   */
  async loadDoc(documentId: number): Promise<Y.Doc> {
    const yDoc = this.yDocsMap.get(documentId);
    if (yDoc) return yDoc;

    const db = this.dbService.kysely;
    const rows = await db
      .selectFrom('document_updates')
      .select('update')
      .where('document_id', '=', documentId)
      .orderBy('created_at', 'asc')
      .execute();

    const newYDoc = new Y.Doc();

    const updates = rows.map((row) => new Uint8Array(row.update));

    // Merge all incremental updates into one before applying — more efficient
    // than calling Y.applyUpdate in a loop.
    const mergedUpdate = Y.mergeUpdates(updates);
    Y.applyUpdate(newYDoc, mergedUpdate);

    this.yDocsMap.set(documentId, newYDoc);
    return newYDoc;
  }

  /**
   * Returns the document with the given ID, throwing 404 if it does not exist
   * and 403 if the requesting user is not the owner.
   *
   * @param documentId - The ID of the document to fetch.
   * @param userId - The ID of the authenticated requesting user.
   * @returns The document row.
   */
  async getDocumentOfUser(
    documentId: number,
    userId: number,
  ): Promise<GetDocumentResponseDto> {
    const db = this.dbService.kysely;

    // Check existence first so we can return the correct error code.
    const row = await db
      .selectFrom('documents')
      .select(['id', 'title', 'creator_id', 'created_at'])
      .where('id', '=', documentId)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Document not found.');
    if (row.creator_id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    return {
      id: row.id,
      title: row.title,
      creatorId: row.creator_id,
      createdAt: row.created_at,
    };
  }

  /**
   * Creates a new document and its initial metadata row in a single transaction,
   * returning the new document's ID. The transaction ensures a metadata row always
   * exists so the library query can treat last_visited_at and last_edited_at as non-nullable.
   *
   * @param userId - The ID of the authenticated user who will own the document.
   * @returns The newly created document's ID.
   */
  async createNewDocument(userId: number): Promise<number> {
    const db = this.dbService.kysely;

    // Wrap in a transaction so the document and its metadata row are always
    // created together — a document with no metadata row would break the
    // library query which treats last_visited_at and last_edited_at as non-nullable.
    const row = await db.transaction().execute(async (tx) => {
      const documentRow = await tx
        .insertInto('documents')
        .values({ creator_id: userId })
        .returning('documents.id')
        .executeTakeFirst();

      if (!documentRow)
        throw new InternalServerErrorException('Failed to create document.');

      // Create the initial metadata row so the library can always read
      // last_visited_at and last_edited_at without needing a left join.
      await tx
        .insertInto('document_user_metadata')
        .values({ document_id: documentRow.id, user_id: userId })
        .execute();

      return documentRow;
    });

    return row.id;
  }

  /**
   * Upserts a `document_user_metadata` row to record that the given user has
   * just visited the document. On conflict it updates `last_visited_at` to now
   * so repeated visits always reflect the most recent open time.
   * @param documentId - the document the user opened
   * @param userId - the authenticated user who opened it
   */
  async recordLastVisited(documentId: number, userId: number): Promise<void> {
    const db = this.dbService.kysely;

    // Insert or update so every open refreshes the timestamp without duplicating rows.
    await db
      .insertInto('document_user_metadata')
      .values({ document_id: documentId, user_id: userId })
      .onConflict((oc) =>
        oc
          .columns(['document_id', 'user_id'])
          .doUpdateSet({ last_visited_at: sql`now()` }),
      )
      .execute();
  }

  /**
   * Upserts a `document_user_metadata` row to record that the given user has
   * just edited the document. On conflict it updates `last_edited_at` to now
   * so the library UI always reflects the most recent edit time per user.
   * @param documentId - the document the user edited
   * @param userId - the authenticated user who made the edit
   */
  async recordLastEdited(documentId: number, userId: number): Promise<void> {
    const db = this.dbService.kysely;

    // Insert or update so every edit refreshes the timestamp without duplicating rows.
    await db
      .insertInto('document_user_metadata')
      .values({ document_id: documentId, user_id: userId })
      .onConflict((oc) =>
        oc
          .columns(['document_id', 'user_id'])
          .doUpdateSet({ last_edited_at: sql`now()` }),
      )
      .execute();
  }

  /**
   * Returns a paginated list of documents owned by the given user, ordered by
   * last_visited_at DESC with id DESC as a tiebreaker. Uses keyset pagination
   * via a compound cursor (lastVisitedAt, id) so performance is consistent
   * regardless of page depth.
   * @param userId - the authenticated user whose documents to list
   * @param limit - maximum number of documents to return
   * @param cursor - compound cursor from the previous page; omit for the first page
   * @returns documents for this page and the nextCursor to fetch the following page
   */
  async getLibraryDocuments(
    userId: number,
    limit: number,
    cursor?: { lastVisitedAt: Date; id: number },
  ): Promise<GetLibraryDocumentsResponseDto> {
    const db = this.dbService.kysely;

    // Build the base query — join users for ownerName and document_user_metadata for timestamps.
    let query = db
      .selectFrom('documents as d')
      .innerJoin('users as u', 'u.id', 'd.creator_id')
      .innerJoin('document_user_metadata as dum', 'dum.document_id', 'd.id')
      .select([
        'd.id',
        'd.title',
        'u.name as ownerName',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
      ])
      .where('d.creator_id', '=', userId)
      .orderBy('dum.last_visited_at', 'desc')
      .orderBy('d.id', 'desc')
      .limit(limit);

    // Apply the compound cursor to fetch only rows after the last seen position.
    if (cursor) {
      query = query.where(({ eb, and, or }) =>
        or([
          eb('dum.last_visited_at', '<', cursor.lastVisitedAt),
          and([
            eb('dum.last_visited_at', '=', cursor.lastVisitedAt),
            eb('d.id', '<', cursor.id),
          ]),
        ]),
      );
    }

    const rows = await query.execute();

    // Map DB rows to the DTO shape.
    const documents: LibraryDocumentDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      ownerName: row.ownerName,
      lastVisitedAt: row.lastVisitedAt,
      lastEditedAt: row.lastEditedAt,
    }));

    // If we got a full page there may be more results — return the cursor
    // pointing at the last item. Otherwise signal end of results with null.
    const nextCursor =
      rows.length === limit
        ? {
            lastVisitedAt: rows[rows.length - 1].lastVisitedAt,
            id: rows[rows.length - 1].id,
          }
        : null;

    return { documents, nextCursor };
  }

  /**
   * Searches the authenticated user's documents by title using trigram similarity,
   * returning results ordered by relevance descending. Empty-title documents are
   * excluded. No minimum score threshold is applied so short queries still return results.
   * @param userId - the authenticated user whose documents to search
   * @param title - the search query to match against document titles
   * @param limit - maximum number of results to return
   * @returns matching documents ordered by similarity score descending
   */
  async searchLibraryDocuments(
    userId: number,
    title: string,
    limit: number,
  ): Promise<SearchLibraryDocumentsResponseDto> {
    const db = this.dbService.kysely;

    // similarity() is provided by pg_trgm and scores how closely the title matches the query.
    // Results are ordered by score descending so the most relevant documents appear first.
    const rows = await db
      .selectFrom('documents as d')
      .innerJoin('users as u', 'u.id', 'd.creator_id')
      .innerJoin('document_user_metadata as dum', 'dum.document_id', 'd.id')
      .select([
        'd.id',
        'd.title',
        'u.name as ownerName',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
        sql<number>`similarity(d.title, ${title})`.as('score'),
      ])
      .where('d.creator_id', '=', userId)
      .where('d.title', '!=', '')
      .orderBy(sql`score`, 'desc')
      .limit(limit)
      .execute();

    // Map DB rows to the DTO shape.
    const documents: LibraryDocumentDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      ownerName: row.ownerName,
      lastVisitedAt: row.lastVisitedAt,
      lastEditedAt: row.lastEditedAt,
    }));

    return { documents };
  }

  /**
   * Persists a new title for the given document and publishes the change to
   * Redis so other server instances can broadcast it to their connected clients.
   * @param documentId - the document to update
   * @param title - the new title string
   */
  async applyDocTitleUpdate(documentId: number, title: string): Promise<void> {
    const db = this.dbService.kysely;

    // Persist the title to the database.
    await db
      .updateTable('documents')
      .set({ title })
      .where('documents.id', '=', documentId)
      .execute();

    // Notify other server instances so they can broadcast to their local clients.
    this.redisService.publish(REDIS_EVENTS.documentTitleUpdate(documentId), {
      title,
    });
  }
}
