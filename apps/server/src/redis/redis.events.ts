/** Redis pub/sub channel name constants for inter-server messaging. */
export const REDIS_EVENTS = {
  /** Published whenever a Yjs update is applied, so other servers can sync. */
  documentUpdate: 'document-update',
};
