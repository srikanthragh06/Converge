/** Redis pub/sub channel name constants for inter-server messaging. */
export const REDIS_EVENTS = {
  /** Published whenever a Yjs update is applied, so other servers can sync. */
  documentUpdate: (documentId: number) => `document-update:${documentId}`,
};

/** Redis key name constants for distributed locks. */
export const REDIS_LOCKS = {
  /** Ensures only one server runs document update compaction at a time. */
  compaction: (documentId: number) => `lock-compaction:${documentId}`,
};
