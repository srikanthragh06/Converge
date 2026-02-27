// Socket.IO typed event interfaces — defines the protocol contract between client and server.
// Keep in sync with web/src/types.ts (no shared package yet).

// Events the server receives from clients
export interface ClientToServerEvents {
    sync_doc: (update: Uint8Array) => void;
    repair_doc: (clientSV: Uint8Array) => void;
}

// Events the server sends to clients
export interface ServerToClientEvents {
    sync_doc: (update: Uint8Array) => void;
    repair_response: (diff: Uint8Array) => void;
}

// Convenience alias used throughout the server socket handlers
import { Socket } from "socket.io";
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
