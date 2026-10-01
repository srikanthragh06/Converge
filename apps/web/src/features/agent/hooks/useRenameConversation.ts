import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import apiClient from "@/lib/http";
import { agentKeys } from "@/features/agent/queryKeys";
import type { AgentConversationSummary } from "./useAgentConversations";

/**
 * Renames an agent conversation via PATCH /agent/conversations/:id. On
 * success it sets the title in the cached list, so the picker shows it at
 * once. A failure shows the global error toast.
 */
const useRenameConversation = () => {
    const workspace = useAtomValue(currentWorkspaceAtom);
    const queryClient = useQueryClient();

    const { mutate } = useMutation({
        mutationFn: async ({
            conversationId,
            title,
        }: {
            conversationId: number;
            title: string;
        }) => {
            await apiClient.patch(`/agent/conversations/${conversationId}`, {
                title,
            });
        },
        meta: { errorMessage: "Couldn't rename the conversation" },
        onSuccess: (_data, { conversationId, title }) => {
            queryClient.setQueryData<AgentConversationSummary[]>(
                agentKeys.conversations(workspace?.id ?? 0),
                (list) =>
                    list?.map((c) =>
                        c.id === conversationId ? { ...c, title } : c,
                    ),
            );
        },
    });

    return {
        renameConversation: (conversationId: number, title: string) =>
            mutate({ conversationId, title }), // sends the rename
    };
};

export default useRenameConversation;
