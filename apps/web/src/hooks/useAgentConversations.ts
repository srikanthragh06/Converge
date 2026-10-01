import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import apiClient from "@/lib/http";
import { agentKeys } from "@/queries/agent";
import type {
    CreateAgentConversationResponseDto,
    GetAgentConversationsResponseDto,
} from "@converge/shared";

/** One conversation as returned by the list/create endpoints. title is null for an untitled conversation, in which case a row falls back to its formatted creation date. */
export type AgentConversationSummary = CreateAgentConversationResponseDto;

/**
 * The current workspace's agent conversations, newest-used first, and which
 * one is selected — the one the user picked, otherwise the most recent.
 * Selection is plain local state, dropped on a workspace switch.
 */
const useAgentConversations = () => {
    const workspace = useAtomValue(currentWorkspaceAtom);
    const workspaceId = workspace?.id ?? 0;
    const [pickedId, setPickedId] = useState<number | null>(null); // conversation the user picked or created; null means the most recent
    const [prevWorkspaceId, setPrevWorkspaceId] = useState(workspace?.id); // workspace the selection belongs to, to spot a switch during render

    // On a workspace switch, drops the selection during render (rather than
    // in an effect): a conversation belongs to one workspace.
    if (workspace?.id !== prevWorkspaceId) {
        setPrevWorkspaceId(workspace?.id);
        setPickedId(null);
    }

    const { data, isPending, isError } = useQuery({
        queryKey: agentKeys.conversations(workspaceId),
        queryFn: async () => {
            const { data } =
                await apiClient.get<GetAgentConversationsResponseDto>(
                    "/agent/conversations",
                    { params: { workspaceId } },
                );
            return data.conversations;
        },
        enabled: workspace !== null,
    });
    const conversations = data ?? [];

    return {
        conversations,
        selectedConversationId: pickedId ?? conversations[0]?.id ?? null,
        // Selects a conversation; null goes back to the most recent.
        selectConversation: setPickedId,
        isLoading: isPending, // true until the first load settles
        error: isError
            ? "Couldn't load conversations. Try refreshing the page."
            : null,
    };
};

export default useAgentConversations;
