// In-memory document registry: docId → { yDoc, lastAccess }.
// Provides lazy loading (getYDocByDocID), access tracking (touchYDoc), and
// periodic eviction of idle documents (setYDocSweepInterval).
// Each cold load subscribes to the doc's Redis channel before querying Postgres
// so updates from other server instances are never missed during the load window.
// Owns all Redis subscription lifecycle state for each doc:
//   subscribeYDocToRedis()     — open channel in buffer mode before Postgres load.
//   activateYDocRedisChannel() — flush buffer and switch to live mode after load.
//   publishYDocUpdate()        — fire-and-forget publish for client-originated updates.
//   unsubscribeYDocFromRedis() — close channel on doc eviction.
// Accesses PersistenceService, PubSubService, and HttpServerService via the global container.

import * as Y from "yjs";
import { DocEntry, SubEntry } from "../types/types";
import { servicesStore } from "../store/servicesStore";
import { PubSubService } from "./PubSubService";
import { SocketHandlerService } from "./SocketHandlerService";
import { REMOTE_ORIGIN } from "../constants/constants";

export class YDocStoreService {
    // Numeric document_id primary key — matches the single doc scope for v0.1.
    static readonly DOCUMENT_ID = 1;

    // Evict docs not accessed for this long (10 minutes).
    private static readonly YDOC_SWEEP_AFTER_MS = 10 * 60 * 1000;

    // How often the sweeper runs.
    private static readonly YDOC_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

    // Doc entries processed per setImmediate tick to avoid blocking the event loop.
    private static readonly YDOC_SWEEP_BATCH_SIZE = 50;

    // Currently live documents: docId → { yDoc, lastAccess }.
    private readonly yDocsMap = new Map<string, DocEntry>();

    // In-flight load promises — prevents duplicate DB queries when two clients
    // connect simultaneously for a document that is not yet in memory.
    private readonly yDocLoadPromiseMap = new Map<string, Promise<Y.Doc>>();

    // Redis subscription state per active docId.
    // Tracks live/buffer status for the cold-start gap-handling protocol.
    private readonly yDocRedisSubEntries = new Map<string, SubEntry>();

    // Returns the cached Y.Doc for docId, loading it from Postgres on first access.
    // Concurrent callers for the same unloaded doc share one in-flight promise so
    // Postgres is queried exactly once even under simultaneous connections.
    async getYDocByDocID(docId: string): Promise<Y.Doc> {
        // Cache hit — refresh lastAccess and return immediately
        const entry = this.yDocsMap.get(docId);
        if (entry) {
            entry.lastAccess = Date.now();
            return entry.yDoc;
        }

        // Load already in progress — wait for it instead of starting a second one
        const existingYDocPromise = this.yDocLoadPromiseMap.get(docId);
        if (existingYDocPromise) return existingYDocPromise;

        // Cold miss — kick off a load and register the promise so concurrent callers share it
        const newYDocLoadPromise = this.loadYDoc(docId);
        this.yDocLoadPromiseMap.set(docId, newYDocLoadPromise);
        return newYDocLoadPromise;
    }

    // Refreshes lastAccess for a loaded doc without triggering a load.
    // Called from socket handlers on every client interaction so the sweeper
    // has an accurate signal. No-op if the doc was already evicted.
    touchYDoc(docId: string): void {
        const entry = this.yDocsMap.get(docId);
        if (entry) {
            entry.lastAccess = Date.now();
        }
    }

    // Starts the periodic sweeper. Called once from App.start() on server startup.
    setYDocSweepInterval(): void {
        setInterval(() => {
            const keys = Array.from(this.yDocsMap.keys());
            if (keys.length > 0) {
                this.sweepYDocBatch(keys, 0);
            }
        }, YDocStoreService.YDOC_SWEEP_INTERVAL_MS);
    }

    // Applies an incoming Redis pub/sub message for a document.
    // Called by PubSubService for every message on a document update channel.
    // Buffers the update if the doc is still loading from Postgres, or applies
    // and broadcasts it immediately if the subscription is already live.
    handleRedisDocumentUpdate(docId: string, rawMessage: string): void {
        const entry = this.yDocRedisSubEntries.get(docId);
        if (!entry) return;

        // Redis delivers messages as strings. The publisher encoded bytes as latin1
        // (lossless binary↔string mapping). Reverse that here to get raw bytes.
        const update = new Uint8Array(Buffer.from(rawMessage, "binary"));

        if (!entry.live) {
            // Still loading from Postgres — buffer for flush in activateYDocRedisChannel().
            entry.buffer.push(update);
            return;
        }

        // Live: apply first so the piggybacked serverSV is accurate, then broadcast.
        // REMOTE_ORIGIN tag prevents any observer in this process from re-publishing.
        Y.applyUpdate(entry.yDoc, update, REMOTE_ORIGIN);
        servicesStore.httpServerService.io
            .to(docId)
            .emit(
                SocketHandlerService.SYNC_DOC,
                update,
                Y.encodeStateVector(entry.yDoc),
            );
    }

    // Subscribes to the Redis channel for docId in buffer mode.
    // Entry is written BEFORE sub.subscribe() so no message can slip between
    // the subscribe call returning and the entry being registered.
    // Idempotent: no-op if already subscribed for this docId.
    async subscribeYDocToRedis(docId: string, yDoc: Y.Doc): Promise<void> {
        if (this.yDocRedisSubEntries.has(docId)) return;

        // Write entry first so the message handler can find it the instant
        // Redis delivers a message.
        this.yDocRedisSubEntries.set(docId, { yDoc, live: false, buffer: [] });

        const channel = PubSubService.DOCUMENT_UPDATE_CHANNEL + docId;
        await servicesStore.redisService.sub.subscribe(channel);
        console.log(`Redis: subscribed to ${channel}`);
    }

    // Flushes the cold-start buffer and switches the subscription to live mode.
    // Merges all buffered updates into one before applying — more efficient than N
    // sequential applies, and Yjs CRDT semantics handle any overlap with the
    // Postgres-loaded history idempotently.
    activateYDocRedisChannel(docId: string): void {
        const entry = this.yDocRedisSubEntries.get(docId);
        if (!entry || entry.live) return;

        if (entry.buffer.length > 0) {
            // Apply first so the piggybacked serverSV reflects the full merged state.
            const merged = Y.mergeUpdates(entry.buffer);
            Y.applyUpdate(entry.yDoc, merged, REMOTE_ORIGIN);
            servicesStore.httpServerService.io
                .to(docId)
                .emit(
                    SocketHandlerService.SYNC_DOC,
                    merged,
                    Y.encodeStateVector(entry.yDoc),
                );
        }

        entry.buffer = [];
        entry.live = true;
        console.log(`Redis: doc ${docId} is now live`);
    }

    // Publishes a raw Yjs binary update to the doc's Redis channel.
    // Binary is encoded as latin1 — a lossless byte→char mapping that survives
    // Redis' string-based pub/sub without data corruption.
    // Fire-and-forget: errors are caught and logged so a publish failure never blocks sync.
    async publishYDocUpdate(docId: string, update: Uint8Array): Promise<void> {
        const channel = PubSubService.DOCUMENT_UPDATE_CHANNEL + docId;
        try {
            await servicesStore.redisService.pub.publish(
                channel,
                Buffer.from(update).toString("binary"),
            );
        } catch (err) {
            console.error(
                `Redis: publishYDocUpdate failed for ${docId}: ${String(err)}`,
            );
        }
    }

    // Removes the subscription entry and unsubscribes from the Redis channel.
    // Called by the sweeper when a doc is evicted from memory.
    async unsubscribeYDocFromRedis(docId: string): Promise<void> {
        if (!this.yDocRedisSubEntries.has(docId)) return;
        this.yDocRedisSubEntries.delete(docId);
        const channel = PubSubService.DOCUMENT_UPDATE_CHANNEL + docId;
        try {
            await servicesStore.redisService.sub.unsubscribe(channel);
            console.log(`Redis: unsubscribed from ${channel}`);
        } catch (err) {
            console.error(
                `Redis: unsubscribeYDocFromRedis failed for ${docId}: ${String(err)}`,
            );
        }
    }

    // Cold-load sequence with Redis gap handling:
    //   1. Subscribe to Redis (buffer mode) before Postgres query starts.
    //   2. Load history from Postgres — Redis messages during this await go to buffer.
    //   3. activateYDocRedisChannel() flushes the buffer and switches to live mode.
    // This ensures no cross-server update is dropped during the load window.
    private async loadYDoc(docId: string): Promise<Y.Doc> {
        const yDoc = new Y.Doc();

        // Step 1: Subscribe before loading — any Redis message arriving during the
        // Postgres query is buffered in yDocRedisSubEntries rather than discarded.
        await this.subscribeYDocToRedis(docId, yDoc);

        // Step 2: Replay persisted history from Postgres.
        await servicesStore.persistenceService.loadYDocFromDb(
            YDocStoreService.DOCUMENT_ID,
            yDoc,
        );

        // Step 3: Flush the cold-start buffer then switch to live mode.
        // Yjs CRDT deduplication handles any overlap between Postgres rows
        // and buffered Redis messages without double-applying ops.
        this.activateYDocRedisChannel(docId);

        this.yDocsMap.set(docId, { yDoc, lastAccess: Date.now() });
        this.yDocLoadPromiseMap.delete(docId);
        console.log(`Doc ${docId} loaded into memory`);
        return yDoc;
    }

    // Processes one batch of keys and evicts stale entries.
    // Calls itself via setImmediate for any remaining keys so the event loop
    // is not blocked on large registries.
    private sweepYDocBatch(keys: string[], offset: number): void {
        const end = Math.min(
            offset + YDocStoreService.YDOC_SWEEP_BATCH_SIZE,
            keys.length,
        );
        for (let i = offset; i < end; i++) {
            const key = keys[i];
            const entry = this.yDocsMap.get(key);
            // Re-check existence: a concurrent getYDocByDocID may have re-populated this key
            if (
                entry &&
                Date.now() - entry.lastAccess >
                    YDocStoreService.YDOC_SWEEP_AFTER_MS
            ) {
                this.yDocsMap.delete(key);
                // Fire-and-forget; errors logged inside unsubscribeYDocFromRedis
                this.unsubscribeYDocFromRedis(key).catch((err) =>
                    console.error(
                        `unsubscribeYDocFromRedis error for ${key}: ${String(err)}`,
                    ),
                );
                console.log(`Evicted doc ${key} from memory`);
            }
        }
        // Yield to the event loop before the next batch
        if (end < keys.length) {
            setImmediate(() => this.sweepYDocBatch(keys, end));
        }
    }
}
