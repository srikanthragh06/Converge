// Socket.IO typed event interfaces — defines the protocol contract between client and server.
// Keep in sync with server/src/types.ts (no shared package yet).

// Events the server sends to this client
export interface ServerToClientEvents {
    joined_doc: (documentId: number) => void; // confirmation that the client joined the room
    left_doc: () => void; // confirmation that the client left the room
    sync_doc: (update: Uint8Array, serverSV: Uint8Array) => void;
    repair_doc: (serverSV: Uint8Array) => void;
    repair_response: (diff: Uint8Array) => void;
    heartbeat_syncack: (diff: Uint8Array, serverSV: Uint8Array) => void;
    socket_pong: (ts: number) => void; // echoed timestamp for RTT measurement
    sync_title: (title: string) => void; // broadcast to room when title is updated via REST
    join_doc_error: (reason: string) => void; // emitted when join_doc fails (e.g. doc not found)
}

// Events this client sends to the server
export interface ClientToServerEvents {
    join_doc: (documentId: number) => void; // request to join a document room
    leave_doc: () => void; // request to leave the current document room
    sync_doc: (update: Uint8Array, sv: Uint8Array) => void;
    repair_doc: (clientSV: Uint8Array) => void;
    repair_response: (diff: Uint8Array) => void;
    heartbeat_sync: (clientSV: Uint8Array) => void;
    heartbeat_ack: (diff: Uint8Array) => void;
    socket_ping: (ts: number) => void; // timestamp sent for RTT measurement
}
