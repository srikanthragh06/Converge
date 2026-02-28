// Redis pub/sub integration for cross-server Yjs update distribution.
//
// initPubSub() — call once at server startup (from main.ts after Redis is ready).
//   Attaches the single global Redis message handler to the sub client.
//
// subscribeDoc(docId, yDoc) — called from docStore.getDoc() before Postgres load.
//   Subscribes to the doc's Redis channel in buffer mode so updates that arrive
//   during the Postgres cold load are held rather than dropped.
//
// goLive(docId) — called from docStore.getDoc() after loadDocFromDb() returns.
//   Flushes the cold-start buffer then switches the subscription to live mode.
//
// publishUpdate(docId, update) — called from socket.ts for client-originated events.
//   Publishes a raw Yjs binary update to the doc's Redis channel.
//   Never called when the update came from Redis — relay loop prevention.
//
// unsubscribeDoc(docId) — called from docStore.ts sweeper on eviction.
//   Removes the subscription entry and unsubscribes from the Redis channel.

import * as Y from "yjs";
import { pub, sub } from "./client";
import { REMOTE_ORIGIN, REDIS_CHANNEL_PREFIX, SYNC_DOC } from "../constants";
// socketServer is imported directly so pubsub can broadcast to local Socket.IO
// clients without requiring any function injection from outside.
// The circular import path (pubsub → server → socket → docStore → pubsub) is safe
// here because socketServer is only accessed inside the message handler callback,
// which fires long after all module-level code has finished executing.
import { socketServer } from "../server";

// Per-document subscription state.
interface SubEntry {
    yDoc: Y.Doc;
    // false while Postgres is still loading; messages go into buffer instead.
    live: boolean;
    // Accumulates Redis messages that arrive during the Postgres cold load.
    buffer: Uint8Array[];
}

// One entry per active docId on this server process.
const subs = new Map<string, SubEntry>();

// Returns the Redis channel name for a given docId (e.g. "yjs:doc-1").
const channelFor = (docId: string): string => REDIS_CHANNEL_PREFIX + docId;

// Must be called once at server startup before any client connects.
// Registers the single global Redis message handler on the sub client.
// Keeping this as an explicit call (rather than module-level code) makes the
// lifecycle clear — the handler is set up at a known point in the startup sequence.
export const initPubSub = (): void => {
    // Single handler for all channels — ioredis fires "message" with the channel
    // name, so we route to the correct SubEntry by reversing the channel prefix.
    sub.on("message", (channel: string, rawMessage: string) => {
        const docId = channel.slice(REDIS_CHANNEL_PREFIX.length);
        const entry = subs.get(docId);
        if (!entry) return;

        // Redis delivers messages as strings. The publisher encoded bytes as latin1
        // (lossless binary↔string mapping). Reverse that here to get raw bytes.
        const update = new Uint8Array(Buffer.from(rawMessage, "binary"));

        if (!entry.live) {
            // Still loading from Postgres — buffer for flush in goLive().
            entry.buffer.push(update);
            return;
        }

        // Live: apply to server Y.Doc first so the SV we piggyback is up to date,
        // then broadcast update + serverSV to all local Socket.IO clients.
        // REMOTE_ORIGIN tag prevents any update observer in this process re-publishing.
        Y.applyUpdate(entry.yDoc, update, REMOTE_ORIGIN);
        socketServer.to(docId).emit(SYNC_DOC, update, Y.encodeStateVector(entry.yDoc));
    });
};

// Subscribes this server to the Redis channel for docId.
// Registers the SubEntry in buffer mode BEFORE calling sub.subscribe() so no
// message can slip between the subscribe call returning and the entry being written.
// Idempotent: if already subscribed for this docId, this is a no-op.
export const subscribeDoc = async (
    docId: string,
    yDoc: Y.Doc,
): Promise<void> => {
    if (subs.has(docId)) return;

    // Write entry first so the message handler can find it the instant Redis delivers
    // a message — the window between subscribe() and subs.set() would otherwise drop updates.
    subs.set(docId, { yDoc, live: false, buffer: [] });

    await sub.subscribe(channelFor(docId));
    console.log(`Redis: subscribed to ${channelFor(docId)}`);
};

// Flushes the cold-start buffer and switches the subscription to live mode.
// Merges all buffered updates into one before applying — more efficient than N
// sequential applies, and Yjs CRDT semantics ensure any overlap with the
// Postgres-loaded history is idempotent.
export const goLive = (docId: string): void => {
    const entry = subs.get(docId);
    if (!entry || entry.live) return;

    if (entry.buffer.length > 0) {
        // Merge all buffered updates into a single update then apply and broadcast.
        // Apply first so the piggybacked serverSV reflects the full merged state.
        const merged = Y.mergeUpdates(entry.buffer);
        Y.applyUpdate(entry.yDoc, merged, REMOTE_ORIGIN);
        socketServer.to(docId).emit(SYNC_DOC, merged, Y.encodeStateVector(entry.yDoc));
    }

    entry.buffer = [];
    entry.live = true;
    console.log(`Redis: doc ${docId} is now live`);
};

// Publishes a raw Yjs binary update to the doc's Redis channel.
// Binary is encoded as latin1 — a lossless byte→char mapping that survives
// Redis' string-based pub/sub without data corruption.
// Fire-and-forget: errors are caught and logged so a publish failure never blocks sync.
export const publishUpdate = async (
    docId: string,
    update: Uint8Array,
): Promise<void> => {
    try {
        await pub.publish(channelFor(docId), Buffer.from(update).toString("binary"));
    } catch (err) {
        console.error(`Redis: publishUpdate failed for ${docId}: ${String(err)}`);
    }
};

// Removes the subscription entry and unsubscribes from the Redis channel.
// Called by the sweeper in docStore.ts when a doc is evicted from memory.
export const unsubscribeDoc = async (docId: string): Promise<void> => {
    if (!subs.has(docId)) return;
    subs.delete(docId);
    try {
        await sub.unsubscribe(channelFor(docId));
        console.log(`Redis: unsubscribed from ${channelFor(docId)}`);
    } catch (err) {
        console.error(`Redis: unsubscribeDoc failed for ${docId}: ${String(err)}`);
    }
};
