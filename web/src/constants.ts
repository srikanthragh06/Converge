// Socket.IO event names — must match the server-side constants exactly
export const SYNC_DOC = "sync_doc";
export const REPAIR_DOC = "repair_doc";
export const REPAIR_RESPONSE = "repair_response";

// Yjs origin tag applied when applying a remotely-received update.
// The Y.Doc update observer checks this to avoid re-sending remote updates back to server.
export const REMOTE_ORIGIN = "remote";

// Debounce window for batching Y.Doc updates before sending to server (milliseconds)
export const BATCH_MS = 300;
