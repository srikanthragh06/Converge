// Cross-server Yjs update distribution via Redis pub/sub.
//
// The Socket.IO server instance is injected via constructor so PubSub can
// broadcast to local clients without importing HttpServer directly.
//
// init()          — attach the global Redis message handler; call once at startup.
// subscribeDoc()  — subscribe in buffer mode before Postgres load begins.
// goLive()        — flush buffer and switch to live mode after Postgres load.
// publishUpdate() — fire-and-forget publish for client-originated updates.
// unsubscribeDoc()— remove subscription on doc eviction.

import * as Y from "yjs";
import Redis from "ioredis";
import { Server as SocketIOServer } from "socket.io";
import { REMOTE_ORIGIN, REDIS_CHANNEL_PREFIX, SYNC_DOC } from "../constants";
import { ClientToServerEvents, ServerToClientEvents } from "../types";
import { SubEntry } from "./types";

export class PubSub {
    // One entry per active docId on this server process.
    private readonly subs = new Map<string, SubEntry>();

    constructor(
        private readonly pub: Redis,
        private readonly sub: Redis,
        private readonly socketServer: SocketIOServer<
            ClientToServerEvents,
            ServerToClientEvents
        >,
    ) {}

    // Must be called once at server startup before any client connects.
    // Registers the single global Redis message handler on the sub client.
    init(): void {
        // Single handler for all channels — routes to the correct SubEntry by
        // reversing the channel prefix.
        this.sub.on("message", (channel: string, rawMessage: string) => {
            const docId = channel.slice(REDIS_CHANNEL_PREFIX.length);
            const entry = this.subs.get(docId);
            if (!entry) return;

            // Redis delivers messages as strings. The publisher encoded bytes as latin1
            // (lossless binary↔string mapping). Reverse that here to get raw bytes.
            const update = new Uint8Array(Buffer.from(rawMessage, "binary"));

            if (!entry.live) {
                // Still loading from Postgres — buffer for flush in goLive().
                entry.buffer.push(update);
                return;
            }

            // Live: apply first so the piggybacked serverSV is accurate, then broadcast.
            // REMOTE_ORIGIN tag prevents any observer in this process from re-publishing.
            Y.applyUpdate(entry.yDoc, update, REMOTE_ORIGIN);
            this.socketServer
                .to(docId)
                .emit(SYNC_DOC, update, Y.encodeStateVector(entry.yDoc));
        });
    }

    // Subscribes to the Redis channel for docId in buffer mode.
    // Entry is written BEFORE sub.subscribe() so no message can slip between
    // the subscribe call returning and the entry being registered.
    // Idempotent: no-op if already subscribed for this docId.
    async subscribeDoc(docId: string, yDoc: Y.Doc): Promise<void> {
        if (this.subs.has(docId)) return;

        // Write entry first so the message handler can find it the instant
        // Redis delivers a message.
        this.subs.set(docId, { yDoc, live: false, buffer: [] });

        await this.sub.subscribe(this.channelFor(docId));
        console.log(`Redis: subscribed to ${this.channelFor(docId)}`);
    }

    // Flushes the cold-start buffer and switches the subscription to live mode.
    // Merges all buffered updates into one before applying — more efficient than N
    // sequential applies, and Yjs CRDT semantics handle any overlap with the
    // Postgres-loaded history idempotently.
    goLive(docId: string): void {
        const entry = this.subs.get(docId);
        if (!entry || entry.live) return;

        if (entry.buffer.length > 0) {
            // Apply first so the piggybacked serverSV reflects the full merged state.
            const merged = Y.mergeUpdates(entry.buffer);
            Y.applyUpdate(entry.yDoc, merged, REMOTE_ORIGIN);
            this.socketServer
                .to(docId)
                .emit(SYNC_DOC, merged, Y.encodeStateVector(entry.yDoc));
        }

        entry.buffer = [];
        entry.live = true;
        console.log(`Redis: doc ${docId} is now live`);
    }

    // Publishes a raw Yjs binary update to the doc's Redis channel.
    // Binary is encoded as latin1 — a lossless byte→char mapping that survives
    // Redis' string-based pub/sub without data corruption.
    // Fire-and-forget: errors are caught and logged so a publish failure never blocks sync.
    async publishUpdate(docId: string, update: Uint8Array): Promise<void> {
        try {
            await this.pub.publish(
                this.channelFor(docId),
                Buffer.from(update).toString("binary"),
            );
        } catch (err) {
            console.error(
                `Redis: publishUpdate failed for ${docId}: ${String(err)}`,
            );
        }
    }

    // Removes the subscription entry and unsubscribes from the Redis channel.
    // Called by DocStore sweeper when a doc is evicted from memory.
    async unsubscribeDoc(docId: string): Promise<void> {
        if (!this.subs.has(docId)) return;
        this.subs.delete(docId);
        try {
            await this.sub.unsubscribe(this.channelFor(docId));
            console.log(`Redis: unsubscribed from ${this.channelFor(docId)}`);
        } catch (err) {
            console.error(
                `Redis: unsubscribeDoc failed for ${docId}: ${String(err)}`,
            );
        }
    }

    private channelFor(docId: string): string {
        return REDIS_CHANNEL_PREFIX + docId;
    }
}
