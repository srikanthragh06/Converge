/** Query keys for API keys. */
export const apiKeyKeys = {
    /** Every API key query. */
    all: ["apiKeys"] as const,
    /** The user's API keys, active and revoked. */
    list: () => ["apiKeys", "list"] as const,
};
