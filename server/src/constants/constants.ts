// Shared server-side constants. Imported by any service that needs them —
// avoids magic strings scattered across the codebase.

import { AccessLevel } from "../types/types";

// Numeric rank for each access level — higher = more permissions.
// Used by hasAccess() for ≥ comparisons without switch/if chains.
export const ACCESS_LEVEL_RANK: Record<AccessLevel, number> = {
    viewer: 1,
    editor: 2,
    admin: 3,
    owner: 4,
};

// Returns true if `actual` is at least as permissive as `required`.
// Example: hasAccess("admin", "editor") → true; hasAccess("viewer", "editor") → false.
export function hasAccess(actual: AccessLevel, required: AccessLevel): boolean {
    return ACCESS_LEVEL_RANK[actual] >= ACCESS_LEVEL_RANK[required];
}

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

// Minimum trigram similarity score for a display_name to appear in user search results.
// 0.1 is slightly stricter than title search — names are shorter so a lower threshold
// would surface too many unrelated results.
export const USER_SEARCH_SIMILARITY_THRESHOLD = 0.1;

// Valid values for the ENVIRONMENT variable — controls which DB credentials are used.
export const ENV_DEV = "DEV";
export const ENV_PROD = "PROD";
