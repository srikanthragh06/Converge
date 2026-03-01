// Type definitions for the db layer.

// Returned by Persistence.saveUpdate so callers can decide whether to
// trigger compaction without an extra round-trip to the database.
export interface SaveUpdateResult {
    count: bigint;            // new monotonic update count for this document
    lastCompactCount: bigint; // last 1000-multiple at which compaction completed
}
