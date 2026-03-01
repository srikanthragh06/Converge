// In-memory document registry: docId → { yDoc, lastAccess }.
// Provides lazy loading (getDoc), access tracking (touchDoc), and
// periodic eviction of idle documents (startSweeper).
// Each cold load subscribes to the doc's Redis channel before querying Postgres
// so updates from other server instances are never missed during the load window.
// Accesses PersistenceService and PubSubService via the global container.

import * as Y from "yjs";
import { DocEntry } from "../types/types";
import { servicesStore } from "../store/servicesStore";

export class DocStoreService {
    // Numeric document_id primary key — matches the single doc scope for v0.1.
    static readonly DOCUMENT_ID = 1;
    // Evict docs not accessed for this long (10 minutes).
    private static readonly EVICT_AFTER_MS = 10 * 60 * 1000;
    // How often the sweeper runs.
    private static readonly SWEEP_INTERVAL_MS = 10 * 60 * 1000;
    // Doc entries processed per setImmediate tick to avoid blocking the event loop.
    private static readonly SWEEP_BATCH_SIZE = 50;
    // Currently live documents
    private readonly docs = new Map<string, DocEntry>();

    // In-flight load promises — prevents duplicate DB queries when two clients
    // connect simultaneously for a document that is not yet in memory.
    private readonly loadingPromises = new Map<string, Promise<Y.Doc>>();

    // Returns the cached Y.Doc for docId, loading it from Postgres on first access.
    // Concurrent callers for the same unloaded doc share one in-flight promise so
    // Postgres is queried exactly once even under simultaneous connections.
    async getDoc(docId: string): Promise<Y.Doc> {
        // Cache hit — refresh lastAccess and return immediately
        const entry = this.docs.get(docId);
        if (entry) {
            entry.lastAccess = Date.now();
            return entry.yDoc;
        }

        // Load already in progress — wait for it instead of starting a second one
        const inFlight = this.loadingPromises.get(docId);
        if (inFlight) return inFlight;

        // Cold miss — kick off a load and register the promise so concurrent callers share it
        const loadPromise = this.loadDoc(docId);
        this.loadingPromises.set(docId, loadPromise);
        return loadPromise;
    }

    // Refreshes lastAccess for a loaded doc without triggering a load.
    // Called from socket handlers on every client interaction so the sweeper
    // has an accurate signal. No-op if the doc was already evicted.
    touchDoc(docId: string): void {
        const entry = this.docs.get(docId);
        if (entry) {
            entry.lastAccess = Date.now();
        }
    }

    // Starts the periodic sweeper. Called once from App.start() on server startup.
    startSweeper(): void {
        setInterval(() => {
            const keys = Array.from(this.docs.keys());
            if (keys.length > 0) {
                this.sweepBatch(keys, 0);
            }
        }, DocStoreService.SWEEP_INTERVAL_MS);
    }

    // Cold-load sequence with Redis gap handling:
    //   1. Subscribe to Redis (buffer mode) before Postgres query starts.
    //   2. Load history from Postgres — Redis messages during this await go to buffer.
    //   3. goLive() flushes the buffer and switches to live mode.
    // This ensures no cross-server update is dropped during the load window.
    private async loadDoc(docId: string): Promise<Y.Doc> {
        const yDoc = new Y.Doc();

        // Step 1: Subscribe before loading — any Redis message arriving during the
        // Postgres query is buffered inside PubSubService rather than discarded.
        await servicesStore.pubSubService.subscribeDoc(docId, yDoc);

        // Step 2: Replay persisted history from Postgres.
        await servicesStore.persistenceService.loadDocFromDb(
            DocStoreService.DOCUMENT_ID,
            yDoc,
        );

        // Step 3: Flush the cold-start buffer then switch to live mode.
        // Yjs CRDT deduplication handles any overlap between Postgres rows
        // and buffered Redis messages without double-applying ops.
        servicesStore.pubSubService.goLive(docId);

        this.docs.set(docId, { yDoc, lastAccess: Date.now() });
        this.loadingPromises.delete(docId);
        console.log(`Doc ${docId} loaded into memory`);
        return yDoc;
    }

    // Processes one batch of keys and evicts stale entries.
    // Calls itself via setImmediate for any remaining keys so the event loop
    // is not blocked on large registries.
    private sweepBatch(keys: string[], offset: number): void {
        const end = Math.min(
            offset + DocStoreService.SWEEP_BATCH_SIZE,
            keys.length,
        );
        for (let i = offset; i < end; i++) {
            const key = keys[i];
            const entry = this.docs.get(key);
            // Re-check existence: a concurrent getDoc may have re-populated this key
            if (
                entry &&
                Date.now() - entry.lastAccess > DocStoreService.EVICT_AFTER_MS
            ) {
                this.docs.delete(key);
                // Fire-and-forget; errors logged inside unsubscribeDoc
                servicesStore.pubSubService
                    .unsubscribeDoc(key)
                    .catch((err) =>
                        console.error(
                            `unsubscribeDoc error for ${key}: ${String(err)}`,
                        ),
                    );
                console.log(`Evicted doc ${key} from memory`);
            }
        }
        // Yield to the event loop before the next batch
        if (end < keys.length) {
            setImmediate(() => this.sweepBatch(keys, end));
        }
    }
}
