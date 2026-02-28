// Socket.IO typed event interfaces — defines the protocol contract between client and server.
// Keep in sync with server/src/types.ts (no shared package yet).

// Events the server sends to this client
export interface ServerToClientEvents {
    sync_doc: (update: Uint8Array, serverSV: Uint8Array) => void;
    repair_doc: (serverSV: Uint8Array) => void;
    repair_response: (diff: Uint8Array) => void;
}

// Events this client sends to the server
export interface ClientToServerEvents {
    sync_doc: (update: Uint8Array, sv: Uint8Array) => void;
    repair_doc: (clientSV: Uint8Array) => void;
    repair_response: (diff: Uint8Array) => void;
}
