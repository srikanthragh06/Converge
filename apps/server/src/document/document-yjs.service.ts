import { forwardRef, Inject, Injectable } from '@nestjs/common';
import type { Socket } from 'socket.io';
import * as Y from 'yjs';
import {
  mapsAreEqual,
  SOCKET_EVENTS,
  SyncDocClientSchema,
  SyncDocTitleClientSchema,
} from '@converge/shared';
import { REDIS_EVENTS } from '../redis/redis.events.js';
import { DatabaseService } from '../db/database.service.js';
import { RedisService } from '../redis/redis.service.js';
import { uint8ArrayToBase64 } from '../utils/utils.js';
import { socketEmitRoom } from '../utils/ws-emit.util.js';
import { DocumentGateway } from './document.gateway.js';
import { sql } from 'kysely';

@Injectable()
export class DocumentYjsService {
  /** In-memory registry of live Y.Doc instances, keyed by document ID. */
  private readonly yDocsMap = new Map<number, Y.Doc>();

  // DocumentGateway also injects DocumentYjsService, so this side needs
  // forwardRef too to let Nest resolve the cycle — see applyDocUpdate for
  // why this dependency exists (broadcasting to the gateway's own room
  // from a single call site instead of every caller doing it separately).
  private readonly documentGateway: DocumentGateway;

  constructor(
    private readonly dbService: DatabaseService,
    private readonly redisService: RedisService,
    // Untyped (not `: DocumentGateway`) on purpose: an explicit class-type
    // annotation here would make TypeScript's emitDecoratorMetadata put the
    // real DocumentGateway class into this constructor's design:paramtypes
    // array, evaluated eagerly at module-load time — which crashes on this
    // circular import regardless of forwardRef, since forwardRef only
    // defers Nest's OWN resolution, not TypeScript's separately-emitted
    // metadata array. Verified empirically with an isolated two-file
    // reproduction before landing this.
    @Inject(forwardRef(() => DocumentGateway))
    documentGateway: any,
  ) {
    this.documentGateway = documentGateway;
  }

  /**
   * Returns the in-memory Y.Doc for the given document, loading and caching it
   * from the database on first access. Subsequent calls return the cached
   * instance, unless rebuild is true.
   * @param documentId - the document to load
   * @param rebuild - if true, always reconstructs the doc fresh from
   * document_updates and replaces the cached instance, instead of trusting
   * whatever is already cached. The cache is only ever kept fresh via a
   * Redis subscription, and that subscription is only ever established when
   * a real client socket connects to this document on this server instance
   * (see document.gateway.ts's handleConnection) — a caller with no socket
   * of its own (e.g. a scheduled background job like
   * DocumentIndexingService.reindexDocument) has no guarantee this instance
   * was ever subscribed, so the cache could be silently, permanently stale.
   * Defaults to false so every existing socket-driven caller (which IS
   * covered by that subscription) keeps its current, cheaper behavior.
   * @returns the live Y.Doc instance for this document
   */
  async loadDoc(documentId: number, rebuild = false): Promise<Y.Doc> {
    if (!rebuild) {
      const cached = this.yDocsMap.get(documentId);
      if (cached) return cached;
    }

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
   * Applies a Yjs update to the shared document, persists it, publishes it to
   * other server instances via Redis, and broadcasts it to this instance's
   * own room — the full job, so callers never need a separate broadcast step
   * of their own (a gap that previously existed here: any caller that forgot
   * to broadcast, like a server-driven write with no originating socket,
   * silently left same-instance viewers with no update until their next
   * repair-sync heartbeat).
   * @param documentId - the document to apply the update to
   * @param update - encoded Yjs update bytes from the client
   * @param excludeSocket - the originating client's socket, if this update
   *   came from a live client edit — excluded from the broadcast since it
   *   already applied its own edit optimistically before sending it. Omit
   *   for server-driven writes with no originating socket (e.g. an MCP
   *   write tool), which broadcasts to every socket in the room instead.
   * @returns the applied update and the server state vector after the update
   */
  async applyDocUpdate(
    documentId: number,
    update: Uint8Array,
    excludeSocket?: Socket,
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
    // not survive JSON.stringify. RedisService.subscribe skips messages
    // published by this same instance (to prevent echo loops), so this alone
    // never reaches this instance's own locally connected clients — that's
    // what the broadcast below is for.
    this.redisService.publish(REDIS_EVENTS.documentUpdate(documentId), {
      updateBase64: uint8ArrayToBase64(update),
    });

    const serverSV = Y.encodeStateVector(yDoc);

    // Broadcast to this instance's own room. socketServer can be undefined
    // only if this is somehow called before the gateway has finished
    // initializing, which can't happen in practice — the app isn't serving
    // any requests yet at that point.
    if (this.documentGateway.socketServer) {
      socketEmitRoom(
        excludeSocket ?? this.documentGateway.socketServer,
        String(documentId),
        SOCKET_EVENTS.SYNC_DOC_CLIENT,
        SyncDocClientSchema,
        {
          documentId,
          updateArray: Array.from(update),
          serverSVArray: Array.from(serverSV),
        },
      );
    }

    return { update, serverSV };
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
   * @param excludeSocket - the originating client's socket, if this update
   *   came from a live client edit — excluded from the broadcast since it
   *   already has the new title. Omit for server-driven writes with no
   *   originating socket, which broadcasts to every socket in the room
   *   instead — same reasoning as applyDocUpdate's excludeSocket.
   */
  async applyDocTitleUpdate(
    documentId: number,
    title: string,
    excludeSocket?: Socket,
  ): Promise<void> {
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

    // Broadcast to this instance's own room — see applyDocUpdate for why
    // this can't be left to the Redis publish alone.
    if (this.documentGateway.socketServer) {
      socketEmitRoom(
        excludeSocket ?? this.documentGateway.socketServer,
        String(documentId),
        SOCKET_EVENTS.SYNC_DOC_TITLE_CLIENT,
        SyncDocTitleClientSchema,
        { title },
      );
    }
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
