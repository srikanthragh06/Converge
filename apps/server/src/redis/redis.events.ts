/** Redis pub/sub channel name constants for inter-server messaging. */
export const REDIS_EVENTS = {
  /** Published whenever a Yjs update is applied, so other servers can sync. */
  documentUpdate: (documentId: number) => `document-update:${documentId}`,
  /** Published whenever a document title is updated, so other servers can broadcast it. */
  documentTitleUpdate: (documentId: number) =>
    `document-title-update:${documentId}`,
  /** Published whenever awareness state changes, carrying the full user list so other servers can forward it without an extra Redis read. */
  awarenessUpdate: (documentId: number) => `awareness-updates:${documentId}`,
};

/** Redis key name constants for awareness state. */
export const REDIS_KEYS = {
  /** Hash of userId → JSON AwarenessUser for all present users in a document. */
  awareness: (documentId: number) => `awareness:${documentId}`,
  /** Set of active socketIds for a user in a document — used for multi-tab ref counting. */
  awarenessSockets: (documentId: number, userId: number) =>
    `awareness-sockets:${documentId}:${userId}`,
  /** Per-IP request counter for POST /auth/google, windowed to 60s. */
  googleAuthRateLimitIp: (ip: string) => `google-auth-ratelimit:ip:${ip}`,
  /** Global (cross-IP) request counter for POST /auth/google, windowed to 60s. */
  googleAuthRateLimitGlobal: 'google-auth-ratelimit:global',
  /** Per-user request counter for Voyage rerank, windowed to 60s. */
  voyageRerankRateLimitUser: (userId: number) =>
    `voyage-rerank-ratelimit:user:${userId}`,
  /** Per-workspace request counter for Voyage rerank, windowed to 60s. */
  voyageRerankRateLimitWorkspace: (workspaceId: number) =>
    `voyage-rerank-ratelimit:workspace:${workspaceId}`,
  /** Global (cross-workspace) request counter for Voyage rerank, windowed to 60s. */
  voyageRerankRateLimitGlobal: 'voyage-rerank-ratelimit:global',
  /** Per-user request counter for OpenAI embedding calls, windowed to 60s (search path only). */
  openaiEmbeddingRateLimitUserRequests: (userId: number) =>
    `openai-embedding-ratelimit:user:${userId}:requests`,
  /** Per-user token counter for OpenAI embedding calls, windowed to 60s (search path only). */
  openaiEmbeddingRateLimitUserTokens: (userId: number) =>
    `openai-embedding-ratelimit:user:${userId}:tokens`,
  /** Per-workspace request counter for OpenAI embedding calls, windowed to 60s. */
  openaiEmbeddingRateLimitWorkspaceRequests: (workspaceId: number) =>
    `openai-embedding-ratelimit:workspace:${workspaceId}:requests`,
  /** Per-workspace token counter for OpenAI embedding calls, windowed to 60s. */
  openaiEmbeddingRateLimitWorkspaceTokens: (workspaceId: number) =>
    `openai-embedding-ratelimit:workspace:${workspaceId}:tokens`,
  /** Global (cross-workspace) request counter for OpenAI embedding calls, windowed to 60s. */
  openaiEmbeddingRateLimitGlobalRequests:
    'openai-embedding-ratelimit:global:requests',
  /** Global (cross-workspace) token counter for OpenAI embedding calls, windowed to 60s. */
  openaiEmbeddingRateLimitGlobalTokens:
    'openai-embedding-ratelimit:global:tokens',
};
