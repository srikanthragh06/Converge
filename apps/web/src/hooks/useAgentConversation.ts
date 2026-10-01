import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { agentKeys } from "@/queries/agent";
import type { GetAgentMessagesResponseDto } from "@converge/shared";

/**
 * One conversation's message history, from GET
 * /agent/conversations/:id/messages, plus refetch() so a caller
 * (useAgentChat, once a live turn finishes) can pull the now-persisted
 * version of a turn that was rendered live via useAgentStream. This hook
 * only reads — it never drives a live send.
 * @param conversationId - The conversation to load history for, or null when nothing is selected yet.
 */
const useAgentConversation = (conversationId: number | null) => {
    const queryClient = useQueryClient();

    const { data, isLoading, isError } = useQuery({
        queryKey: agentKeys.messages(conversationId ?? 0),
        queryFn: async () => {
            const { data } = await apiClient.get<GetAgentMessagesResponseDto>(
                `/agent/conversations/${conversationId}/messages`,
            );
            return data.messages;
        },
        enabled: conversationId !== null,
    });

    return {
        messages: data ?? [], // in insertion order, as returned by the server
        isLoading, // true only while a conversation's first load is in flight, never a background refetch
        error: isError ? "Couldn't load this conversation's messages." : null,
        /** Re-pulls a conversation's history (default: the current one), without surfacing a loading state; resolves once it has loaded. */
        refetch: (targetId: number | null = conversationId) =>
            targetId === null
                ? Promise.resolve()
                : queryClient.invalidateQueries({
                      queryKey: agentKeys.messages(targetId),
                  }),
    };
};

export default useAgentConversation;
