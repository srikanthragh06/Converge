// Shared server-side types: doc store, pub/sub, persistence, and socket protocol.
// Keep socket event interfaces in sync with web/src/types.ts (no shared package yet).

import * as Y from "yjs";
import { Socket } from "socket.io";

// Registry entry for an in-memory document (DocStoreService).
export interface DocEntry {
    yDoc: Y.Doc;
    lastAccess: number; // Date.now() timestamp — updated on every client interaction
}

// Per-document Redis subscription state held by YDocStoreService.
export interface SubEntry {
    yDoc: Y.Doc;
    live: boolean; // false while Postgres is still loading; messages go into buffer instead
    buffer: Uint8Array[]; // accumulates Redis messages that arrive during the Postgres cold load
}

// Returned by PersistenceService.saveUpdate so callers can decide whether to
// trigger compaction without an extra round-trip to the database.
export interface SaveUpdateResult {
    count: bigint; // new monotonic update count for this document
    lastCompactCount: bigint; // last threshold-multiple at which compaction completed
}

// Events the server receives from clients
export interface ClientToServerEvents {
    join_doc: (documentId: number) => void; // request to join a document room
    leave_doc: () => void; // request to leave the current document room
    sync_doc: (update: Uint8Array, sv: Uint8Array) => void;
    repair_doc: (clientSV: Uint8Array) => void;
    repair_response: (diff: Uint8Array) => void;
    heartbeat_sync: (clientSV: Uint8Array) => void;
    heartbeat_ack: (diff: Uint8Array) => void;
    socket_ping: (ts: number) => void; // timestamp from client for RTT measurement
}

// Events the server sends to clients
export interface ServerToClientEvents {
    joined_doc: (documentId: number) => void; // confirmation that the client joined the room
    left_doc: () => void; // confirmation that the client left the room
    sync_doc: (update: Uint8Array, serverSV: Uint8Array) => void;
    repair_doc: (serverSV: Uint8Array) => void;
    repair_response: (diff: Uint8Array) => void;
    heartbeat_syncack: (diff: Uint8Array, serverSV: Uint8Array) => void;
    socket_pong: (ts: number) => void; // echoed timestamp for RTT measurement
}

// Per-connection state stored in socket.data after a successful join_doc.
// Optional because it is unset before join_doc and after leave_doc.
export interface SocketData {
    documentId?: number; // numeric Postgres primary key for the joined document
}

// Convenience alias used throughout the server socket handlers
export type TypedSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
>;
