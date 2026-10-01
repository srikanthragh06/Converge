import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import apiClient from "@/lib/http";
import { agentKeys } from "@/features/agent/queryKeys";
import type { AgentConversationSummary } from "./useAgentConversations";

/**
 * Deletes an agent conversation for good via DELETE
 * /agent/conversations/:id. On success it drops the conversation from the
 * cached list and its messages from the cache, then calls onSuccess. A
 * failure shows the global error toast.
 * @param onSuccess - called with the deleted conversation's id
 */
const useDeleteConversation = ({
    onSuccess,
}: {
    onSuccess: (conversationId: number) => void;
}) => {
    const workspace = useAtomValue(currentWorkspaceAtom);
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async (conversationId: number) => {
            await apiClient.delete(`/agent/conversations/${conversationId}`);
        },
        meta: { errorMessage: "Couldn't delete the conversation" },
        onSuccess: (_data, conversationId) => {
            queryClient.setQueryData<AgentConversationSummary[]>(
                agentKeys.conversations(workspace?.id ?? 0),
                (list) => list?.filter((c) => c.id !== conversationId),
            );
            queryClient.removeQueries({
                queryKey: agentKeys.messages(conversationId),
            });
            onSuccess(conversationId);
        },
    });

    return {
        deleteConversation: (conversationId: number) => mutate(conversationId), // sends the delete
        isDeleting: isPending, // true while the delete request is in flight
    };
};

export default useDeleteConversation;
