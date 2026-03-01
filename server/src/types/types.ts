// Internal types for the doc store layer.

import * as Y from "yjs";

// Registry entry for an in-memory document.
export interface DocEntry {
    yDoc: Y.Doc;
    lastAccess: number; // Date.now() timestamp — updated on every client interaction
}
// Internal types for the Redis pub/sub layer.

// Per-document subscription state held by PubSub.
export interface SubEntry {
    yDoc: Y.Doc;
    // false while Postgres is still loading; messages go into buffer instead.
    live: boolean;
    // Accumulates Redis messages that arrive during the Postgres cold load.
    buffer: Uint8Array[];
}

// Type definitions for the db layer.

// Returned by Persistence.saveUpdate so callers can decide whether to
// trigger compaction without an extra round-trip to the database.
export interface SaveUpdateResult {
    count: bigint; // new monotonic update count for this document
    lastCompactCount: bigint; // last 1000-multiple at which compaction completed
}

// Socket.IO typed event interfaces — defines the protocol contract between client and server.
// Keep in sync with web/src/types.ts (no shared package yet).

import { Socket } from "socket.io";

// Events the server receives from clients
export interface ClientToServerEvents {
    sync_doc: (update: Uint8Array, sv: Uint8Array) => void;
    repair_doc: (clientSV: Uint8Array) => void;
    repair_response: (diff: Uint8Array) => void;
    heartbeat_sync: (clientSV: Uint8Array) => void;
    heartbeat_ack: (diff: Uint8Array) => void;
}

// Events the server sends to clients
export interface ServerToClientEvents {
    sync_doc: (update: Uint8Array, serverSV: Uint8Array) => void;
    repair_doc: (serverSV: Uint8Array) => void;
    repair_response: (diff: Uint8Array) => void;
    heartbeat_syncack: (diff: Uint8Array, serverSV: Uint8Array) => void;
}

// Convenience alias used throughout the server socket handlers
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
