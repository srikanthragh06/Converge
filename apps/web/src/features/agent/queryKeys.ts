/**
 * Query keys for the Ask Converge agent. The conversation list and the
 * messages use different second parts on purpose: "conversation-list" and
 * "messages" never share a start, so refreshing one never hits the other.
 */
export const agentKeys = {
    /** Every agent query. */
    all: ["agent"] as const,
    /** A workspace's conversations. */
    conversations: (workspaceId: number) =>
        ["agent", "conversation-list", workspaceId] as const,
    /** One conversation's messages. */
    messages: (conversationId: number) =>
        ["agent", "messages", conversationId] as const,
};
