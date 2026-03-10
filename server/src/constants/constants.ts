// Shared server-side constants. Imported by any service that needs them —
// avoids magic strings scattered across the codebase.

// Redis SET command returns "OK" on success. Used to check whether a
// distributed NX lock was successfully acquired.
export const REDIS_OK = "OK";

// Yjs origin tag passed as the third argument to Y.applyUpdate().
// Any Y.Doc observer that sees this origin must skip re-broadcasting the
// update — it already came from a remote source (Redis pub/sub or client relay).
export const REMOTE_ORIGIN = "remote";

// JWT lifetime passed to jwt.sign() expiresIn option.
export const JWT_EXPIRES_IN = "7d";

// JWT cookie maxAge in milliseconds — must correspond to JWT_EXPIRES_IN.
export const JWT_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Minimum trigram similarity score for a title to appear in search results.
// 0.05 is permissive — filters out completely unrelated titles while still
// surfacing partial matches on short or abbreviated title strings.
export const TITLE_SEARCH_SIMILARITY_THRESHOLD = 0.05;
