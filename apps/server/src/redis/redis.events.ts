/** Redis pub/sub channel name constants for inter-server messaging. */
export const REDIS_EVENTS = {
  /** Published whenever a Yjs update is applied, so other servers can sync. */
  documentUpdate: (documentId: number) => `document-update:${documentId}`,
  /** Published whenever a document title is updated, so other servers can broadcast it. */
  documentTitleUpdate: (documentId: number) =>
    `document-title-update:${documentId}`,
};

/** Redis key name constants for distributed locks. */
export const REDIS_LOCKS = {
  /** Ensures only one server runs document update compaction at a time. */
  compaction: (documentId: number) => `lock-compaction:${documentId}`,
};

/** Redis key name constants for awareness state. */
export const REDIS_KEYS = {
  /** Set of active socketIds for a user in a document — used for multi-tab ref counting. */
  awarenessSockets: (documentId: number, userId: number) =>
    `awareness-sockets:${documentId}:${userId}`,
};
