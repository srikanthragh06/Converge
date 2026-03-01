// Socket.IO event names — must match the client-side constants exactly
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
// Any Y.Doc update observer that would re-broadcast must skip this origin.
export const REMOTE_ORIGIN = "remote";

// The single document room all clients join (single-doc scope for v0.1)
export const DOC_ID = "doc-1";

// Numeric document_id used as the primary key in the database.
// Separate from DOC_ID (the Socket.IO room string) — v0.1+ will look this up dynamically.
export const DOCUMENT_ID = 1;

// Doc store sweeper: evict docs not accessed for this long
export const EVICT_AFTER_MS = 10 * 60 * 1000; // 10 minutes

// How often the sweeper runs
export const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Number of doc entries processed per setImmediate tick to avoid blocking the event loop
export const SWEEP_BATCH_SIZE = 50;

// Redis pub/sub channel prefix — full channel name is REDIS_CHANNEL_PREFIX + docId
// e.g. "yjs:doc-1"
export const REDIS_CHANNEL_PREFIX = "yjs:";

// Compaction is triggered when update_count crosses a new multiple of this value.
// BigInt because document_meta.update_count is BIGINT and Kysely maps it to JS BigInt.
export const COMPACTION_THRESHOLD = BigInt(500);
