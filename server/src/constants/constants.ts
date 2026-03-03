// Shared server-side constants. Imported by any service that needs them —
// avoids magic strings scattered across the codebase.

// Redis SET command returns "OK" on success. Used to check whether a
// distributed NX lock was successfully acquired.
export const REDIS_OK = "OK";

// Yjs origin tag passed as the third argument to Y.applyUpdate().
// Any Y.Doc observer that sees this origin must skip re-broadcasting the
// update — it already came from a remote source (Redis pub/sub or client relay).
export const REMOTE_ORIGIN = "remote";
