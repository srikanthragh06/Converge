import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import { mapsAreEqual } from '@converge/shared';
import { REDIS_EVENTS, REDIS_LOCKS } from '../redis/redis.events';
import { DatabaseService } from '../db/database.service';
import { RedisService } from '../redis/redis.service';
import { uint8ArrayToBase64 } from '../utils/utils';
import { sql } from 'kysely';

@Injectable()
export class DocumentYjsService {
  /** In-memory registry of live Y.Doc instances, keyed by document ID. */
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
   * Returns the in-memory Y.Doc for the given document, loading and caching it
   * from the database on first access. Subsequent calls return the cached instance.
   * @param documentId - the document to load
   * @returns the live Y.Doc instance for this document
   */
  async loadDoc(documentId: number): Promise<Y.Doc> {
    const yDoc = this.yDocsMap.get(documentId);
    if (yDoc) return yDoc;

    const db = this.dbService.kysely;

    // Fetch all persisted updates in insertion order.
    const rows = await db
      .selectFrom('document_updates')
      .select('update')
      .where('document_id', '=', documentId)
      .orderBy('created_at', 'asc')
      .execute();

    const newYDoc = new Y.Doc();

    // Merge all incremental updates into one before applying — more efficient
    // than calling Y.applyUpdate in a loop.
    const mergedUpdate = Y.mergeUpdates(
      rows.map((row) => new Uint8Array(row.update)),
    );
    Y.applyUpdate(newYDoc, mergedUpdate);

    this.yDocsMap.set(documentId, newYDoc);
    return newYDoc;
  }

  /**
   * Applies a Yjs update to the shared document, persists it, and publishes it
   * to other server instances via Redis. Returns the update and the server's new
   * state vector.
   * @param documentId - the document to apply the update to
   * @param update - encoded Yjs update bytes from the client
   * @returns the applied update and the server state vector after the update
   */
  async applyDocUpdate(
    documentId: number,
    update: Uint8Array,
  ): Promise<{ update: Uint8Array; serverSV: Uint8Array }> {
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
        const { update_count: updateCount, last_compact_count: lastCompactCount } =
          updatedRows[0];
        if (updateCount >= lastCompactCount + this.COMPACTION_THRESHOLD) {
          compactionRequired = true;
        }
      }
    });

    // Apply the update to the in-memory doc.
    Y.applyUpdate(yDoc, update);

    // Fire-and-forget compaction check — not awaited so it does not block the write path.
    if (compactionRequired) this.compactUpdatesIfRequired(documentId);

    // Publish to other server instances via Redis pub/sub so their in-memory
    // docs stay in sync. The update is base64-encoded because Uint8Array does
    // not survive JSON.stringify.
    this.redisService.publish(REDIS_EVENTS.documentUpdate(documentId), {
      updateBase64: uint8ArrayToBase64(update),
    });

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
  ): Promise<Uint8Array> {
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

    // Decode both state vectors into Maps and compare them entry-for-entry.
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
  ): Promise<{ diff: Uint8Array; serverSV: Uint8Array }> {
    const yDoc = await this.loadDoc(documentId);

    // Encode only the updates the client has not yet seen.
    const diff = Y.encodeStateAsUpdate(yDoc, clientSV);
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

        const { update_count: updateCount, last_compact_count: lastCompactCount } = row;

        if (updateCount < lastCompactCount + this.COMPACTION_THRESHOLD) return;

        const maxUpdateIdRow = await tx
          .selectFrom('document_updates')
          .where('document_updates.document_id', '=', documentId)
          .select(sql<string | null>`max(id)`.as('maxUpdateId'))
          .executeTakeFirst();

        if (maxUpdateIdRow === undefined || maxUpdateIdRow.maxUpdateId === null) {
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
}
