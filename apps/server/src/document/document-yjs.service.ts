import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import { mapsAreEqual } from '@converge/shared';
import { REDIS_EVENTS } from '../redis/redis.events';
import { DatabaseService } from '../db/database.service';
import { RedisService } from '../redis/redis.service';
import { uint8ArrayToBase64 } from '../utils/utils';
import { sql } from 'kysely';

@Injectable()
export class DocumentYjsService {
  /** In-memory registry of live Y.Doc instances, keyed by document ID. */
  private readonly yDocsMap = new Map<number, Y.Doc>();

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

    // Append the raw Yjs update bytes to the persistent update log. Version-history
    // checkpoints fold rows like this one into a single is_checkpoint row later —
    // no separate bookkeeping is needed here for that.
    await db
      .insertInto('document_updates')
      .values({ update: Buffer.from(update), document_id: documentId })
      .execute();

    // Apply the update to the in-memory doc.
    Y.applyUpdate(yDoc, update);

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
   * Removes the Y.Doc for the given document from the in-memory registry,
   * freeing its memory. The next access will reload it from the database.
   * Called when this server instance has no more sockets connected to the document.
   * @param documentId - the document to evict
   */
  evictDoc(documentId: number): void {
    this.yDocsMap.delete(documentId);
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
