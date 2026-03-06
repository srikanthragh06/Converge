// Socket.IO event names — must match the server-side constants exactly
export const SYNC_DOC = "sync_doc";
export const REPAIR_DOC = "repair_doc";
export const REPAIR_RESPONSE = "repair_response";

// Heartbeat reconciliation events — periodic full bidirectional sync
// HEARTBEAT_SYNC:    client → server  (clientSV)
// HEARTBEAT_SYNCACK: server → client  (diff for client, serverSV)
// HEARTBEAT_ACK:     client → server  (diff for server)
export const HEARTBEAT_SYNC = "heartbeat_sync";
export const HEARTBEAT_SYNCACK = "heartbeat_syncack";
export const HEARTBEAT_ACK = "heartbeat_ack";

// How often the client fires a heartbeat (milliseconds)
export const HEARTBEAT_INTERVAL_MS = 10_000;

// Yjs origin tag applied when applying a remotely-received update.
// The Y.Doc update observer checks this to avoid re-sending remote updates back to server.
export const REMOTE_ORIGIN = "remote";

// Debounce window for batching Y.Doc updates before sending to server (milliseconds)
export const BATCH_MS = 300;

// Ping/pong events for measuring round-trip latency to the server.
// Client sends socket_ping with a timestamp; server echoes it back as socket_pong.
export const SOCKET_PING = "socket_ping";
export const SOCKET_PONG = "socket_pong";

// How often the client fires a ping probe (milliseconds)
export const PING_INTERVAL_MS = 5_000;
