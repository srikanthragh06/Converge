import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import apiClient from "@/lib/http";
import { agentKeys } from "@/queries/agent";
import type { CreateAgentConversationResponseDto } from "@converge/shared";

/**
 * Starts a new agent conversation in the current workspace via POST
 * /agent/conversations. On success it puts the conversation at the top of
 * the cached list right away (so it can be selected before the list
 * re-fetches) and refreshes the list. A failure shows the global error toast.
 * @param onSuccess - called with the new conversation, e.g. to select it
 */
const useCreateConversation = ({
    onSuccess,
}: {
    onSuccess: (conversation: CreateAgentConversationResponseDto) => void;
}) => {
    const workspace = useAtomValue(currentWorkspaceAtom);
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async (workspaceId: number) => {
            const { data } =
                await apiClient.post<CreateAgentConversationResponseDto>(
                    "/agent/conversations",
                    { workspaceId },
                );
            return data;
        },
        meta: { errorMessage: "Couldn't start a new conversation" },
        onSuccess: (conversation) => {
            const key = agentKeys.conversations(conversation.workspaceId);
            queryClient.setQueryData<CreateAgentConversationResponseDto[]>(
                key,
                (list) => list && [conversation, ...list],
            );
            queryClient.invalidateQueries({ queryKey: key });
            onSuccess(conversation);
        },
    });

    return {
        /**
         * Creates the conversation. No-ops before the workspace loads.
         * @param onCreated - also called with the new conversation's id, e.g.
         *                    to send the message that needed it
         */
        createConversation: (onCreated?: (conversationId: number) => void) => {
            if (workspace)
                mutate(workspace.id, {
                    onSuccess: (conversation) => onCreated?.(conversation.id),
                });
        },
        isCreating: isPending, // true while the create request is in flight
    };
};

export default useCreateConversation;
