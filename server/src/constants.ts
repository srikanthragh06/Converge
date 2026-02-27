// Socket.IO event names — must match the client-side constants exactly
export const SYNC_DOC = "sync_doc";
export const REPAIR_DOC = "repair_doc";
export const REPAIR_RESPONSE = "repair_response";

// Yjs origin tag applied when applying a remotely-received update.
// Any Y.Doc update observer that would re-broadcast must skip this origin.
export const REMOTE_ORIGIN = "remote";

// The single document room all clients join (single-doc scope for v0.1)
export const DOC_ID = "doc-1";
