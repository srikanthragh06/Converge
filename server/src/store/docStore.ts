// In-memory document registry: docId → { yDoc, lastAccess }.
// Provides lazy loading (getDoc), access tracking (touchDoc), and
// periodic eviction of idle documents (startSweeper).
// Each cold load subscribes to the doc's Redis channel before querying Postgres
// so updates from other server instances are never missed during the load window.

import * as Y from "yjs";
import { loadDocFromDb } from "../db/persistence";
import { subscribeDoc, goLive, unsubscribeDoc } from "../redis/pubsub";
import {
    EVICT_AFTER_MS,
    SWEEP_INTERVAL_MS,
    SWEEP_BATCH_SIZE,
} from "../constants";

interface DocEntry {
    yDoc: Y.Doc;
    lastAccess: number; // Date.now() timestamp — updated on every client interaction
}

// Currently live documents
const docs = new Map<string, DocEntry>();

// In-flight load promises — prevents duplicate DB queries when two clients connect
// simultaneously for a document that is not yet in memory
const loadingPromises = new Map<string, Promise<Y.Doc>>();

// Returns the cached Y.Doc for docId, loading it from Postgres on first access.
// Concurrent callers for the same unloaded doc share one in-flight promise so
// Postgres is queried exactly once even under simultaneous connections.
export const getDoc = async (docId: string): Promise<Y.Doc> => {
    // Cache hit — refresh lastAccess and return immediately
    const entry = docs.get(docId);
    if (entry) {
        entry.lastAccess = Date.now();
        return entry.yDoc;
    }

    // Load already in progress — wait for it instead of starting a second one
    const inFlight = loadingPromises.get(docId);
    if (inFlight) return inFlight;

    // Cold miss — start a new load with Redis gap handling:
    //   1. Subscribe to Redis (buffer mode) before Postgres query starts.
    //   2. Load history from Postgres — Redis messages during this await go to buffer.
    //   3. goLive() flushes the buffer and switches to live mode.
    // This ensures no cross-server update is dropped during the load window.
    const loadPromise = (async (): Promise<Y.Doc> => {
        const yDoc = new Y.Doc();

        // Step 1: Subscribe before loading — any Redis message arriving during the
        // Postgres query is buffered inside pubsub.ts rather than discarded.
        await subscribeDoc(docId, yDoc);

        // Step 2: Replay persisted history from Postgres.
        await loadDocFromDb(yDoc);

        // Step 3: Flush the cold-start buffer then switch to live mode.
        // Yjs CRDT deduplication handles any overlap between Postgres rows
        // and buffered Redis messages without double-applying ops.
        goLive(docId);

        docs.set(docId, { yDoc, lastAccess: Date.now() });
        loadingPromises.delete(docId);
        console.log(`Doc ${docId} loaded into memory`);
        return yDoc;
    })();

    loadingPromises.set(docId, loadPromise);
    return loadPromise;
};

// Refreshes lastAccess for a loaded doc without triggering a load.
// Called from socket handlers on every client interaction so the sweeper
// has an accurate signal. No-op if the doc was already evicted.
export const touchDoc = (docId: string): void => {
    const entry = docs.get(docId);
    if (entry) {
        entry.lastAccess = Date.now();
    }
};

// --- sweeper ---

// Processes one batch of keys and evicts stale entries.
// Calls itself via setImmediate for any remaining keys so the event loop
// is not blocked on large registries.
const sweepBatch = (keys: string[], offset: number): void => {
    const end = Math.min(offset + SWEEP_BATCH_SIZE, keys.length);
    for (let i = offset; i < end; i++) {
        const key = keys[i];
        const entry = docs.get(key);
        // Re-check existence: a concurrent getDoc may have re-populated this key
        if (entry && Date.now() - entry.lastAccess > EVICT_AFTER_MS) {
            docs.delete(key);
            // Unsubscribe from Redis — fire-and-forget; errors logged inside unsubscribeDoc
            unsubscribeDoc(key).catch((err) =>
                console.error(`unsubscribeDoc error for ${key}: ${String(err)}`),
            );
            console.log(`Evicted doc ${key} from memory`);
        }
    }
    // Yield to the event loop before the next batch
    if (end < keys.length) {
        setImmediate(() => sweepBatch(keys, end));
    }
};

// Starts the periodic sweeper. Called once from main.ts on server startup.
export const startSweeper = (): void => {
    setInterval(() => {
        const keys = Array.from(docs.keys());
        if (keys.length > 0) {
            sweepBatch(keys, 0);
        }
    }, SWEEP_INTERVAL_MS);
};
