import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import { mapsAreEqual } from '@converge/shared';
import { REDIS_EVENTS } from '../redis/redis.events';
import { DatabaseService } from '../db/database.service';
import { RedisService } from '../redis/redis.service';
import { uint8ArrayToBase64 } from '../utils/utils';

@Injectable()
export class DocumentService {
  // Single in-memory Y.Doc shared across all clients. Temporary until
  // per-document persistence is introduced.
  private readonly yDoc = new Y.Doc();

  constructor(
    private readonly dbService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Loads all persisted Yjs updates from the database and applies them to the
   * in-memory doc. Called once at startup before the server accepts connections,
   * so the in-memory state reflects the last saved document state.
   */
  async populateInMemoryYdoc(): Promise<void> {
    const db = this.dbService.kysely;
    const rows = await db
      .selectFrom('document_updates')
      .select('update')
      .orderBy('created_at', 'asc')
      .execute();

    // Nothing to apply if the table is empty (fresh start).
    if (rows.length === 0) {
      console.log('No persisted updates found, starting with empty doc');
      return;
    }

    const updates = rows.map((row) => new Uint8Array(row.update));

    // Merge all incremental updates into one before applying — more efficient
    // than calling Y.applyUpdate in a loop.
    const mergedUpdate = Y.mergeUpdates(updates);
    Y.applyUpdate(this.yDoc, mergedUpdate);
    console.log(`In-memory doc restored from ${rows.length} persisted updates`);
  }

  /**
   * Applies a Yjs update to the shared document and returns the update
   * along with the server's new state vector.
   * @param update - encoded Yjs update bytes from the client
   * @returns the applied update and the server state vector after the update
   */
  async applyYDocUpdate(update: Uint8Array): Promise<{
    update: Uint8Array;
    serverSV: Uint8Array;
  }> {
    // Persist before applying to memory. If the insert fails, the in-memory doc
    // simply misses this update — the repair sync protocol will eventually
    // reconcile the divergence. The reverse (apply then failed insert) is worse:
    // the update would exist in memory but never be persisted, so it would be
    // permanently lost on restart.
    const db = this.dbService.kysely;
    await db
      .insertInto('document_updates')
      .values({ update: Buffer.from(update) })
      .execute();

    Y.applyUpdate(this.yDoc, update);

    // Publish to other server instances via Redis pub/sub so their in-memory
    // docs stay in sync. The update is base64-encoded because Uint8Array does
    // not survive JSON.stringify.
    this.redisService.publish(REDIS_EVENTS.documentUpdate, {
      updateBase64: uint8ArrayToBase64(update),
    });

    // return the update unchanged alongside the new server state vector
    return { update, serverSV: Y.encodeStateVector(this.yDoc) };
  }

  /**
   * Returns true if the client's state vector matches the server's,
   * indicating the two documents are fully in sync.
   * @param clientSV - the client's encoded state vector
   * @returns true if both state vectors are equal entry-for-entry
   */
  isClientAndServerDocSynced(clientSV: Uint8Array): boolean {
    // decode both state vectors into Maps and compare them entry-for-entry
    return mapsAreEqual(
      Y.decodeStateVector(Y.encodeStateVector(this.yDoc)),
      Y.decodeStateVector(clientSV),
    );
  }

  /**
   * Computes the updates the client is missing relative to its state vector
   * and returns them alongside the server's current state vector.
   * @param clientSV - the client's encoded state vector
   * @returns the diff the client needs and the server's current state vector
   */
  getClientServerDocDiff(clientSV: Uint8Array): {
    diff: Uint8Array;
    serverSV: Uint8Array;
  } {
    // encode only the updates the client has not yet seen
    const diff = Y.encodeStateAsUpdate(this.yDoc, clientSV);
    // snapshot the server SV so the client can detect any remaining gaps
    const serverSV = Y.encodeStateVector(this.yDoc);
    return { diff, serverSV };
  }
}
