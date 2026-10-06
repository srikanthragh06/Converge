import type { AgentConversationSummary } from "@/features/agent/hooks/useAgentConversations";
import { formatDate } from "@/lib/utils";

/**
 * A conversation's display name: its title, or for an untitled one its
 * creation time, e.g. "Sep 20, 2026, 2:59 p.m." (as in the mockups).
 * @param conversation - the conversation to name
 */
export const conversationLabel = (conversation: AgentConversationSummary) =>
    conversation.title ??
    formatDate(conversation.createdAt, { seconds: false });
