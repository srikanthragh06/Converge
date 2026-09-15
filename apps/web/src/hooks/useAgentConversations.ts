import { useCallback, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import apiClient from "@/lib/http";
import type {
    CreateAgentConversationResponseDto,
    GetAgentConversationsResponseDto,
} from "@converge/shared";

/** One conversation as returned by the list/create endpoints — no title field exists yet, so a row is only ever identified by when it was created. */
export type AgentConversationSummary = CreateAgentConversationResponseDto;

/**
 * Lists the current workspace's agent conversations and tracks which one is
 * selected. Deliberately scoped to just listing/selecting/creating — no
 * message history or chat sending here, since the chat panel itself isn't
 * built yet. Selection is plain local state with no persistence: nothing
 * downstream reads it yet, so there's nothing to keep in sync across a
 * reload until a chat panel actually consumes it.
 */
const useAgentConversations = () => {
    const workspace = useAtomValue(currentWorkspaceAtom); // the currently selected workspace, read from the global sidebar atom
    const [conversations, setConversations] = useState<AgentConversationSummary[]>([]); // the workspace's conversations, newest-used first
    const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null); // which conversation is highlighted/active; null until one is auto-selected or clicked
    const [isLoading, setIsLoading] = useState(true); // true while the list is being (re)fetched
    const [error, setError] = useState<string | null>(null); // last fetch/create failure message, if any

    /**
     * Fetches the conversation list for the given workspace and replaces
     * local state with the result.
     *
     * @param workspaceId - The workspace to list conversations under.
     */
    const fetchConversations = useCallback(async (workspaceId: number) => {
        // Mark the fetch as in flight and clear any stale error before it resolves.
        setIsLoading(true);
        setError(null);
        try {
            // Request the list, newest-used first (see AgentService.listConversations).
            const { data } = await apiClient.get<GetAgentConversationsResponseDto>(
                "/agent/conversations",
                { params: { workspaceId } },
            );
            setConversations(data.conversations);
            // Auto-select the most recent conversation only if nothing is
            // already selected, so this never overrides a deliberate click
            // (e.g. a refetch after creating a new conversation, which
            // already selected the new one itself).
            setSelectedConversationId((current) => current ?? data.conversations[0]?.id ?? null);
        } catch {
            setError("Couldn't load conversations. Try refreshing the page.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Creates a new conversation in the current workspace, selects it
     * immediately, and refetches the list so it appears alongside the
     * others.
     *
     * @returns A promise that resolves once the new conversation has been created, selected, and the list refetched.
     */
    const createConversation = useCallback(async () => {
        // No workspace selected yet — nothing to create a conversation under.
        if (!workspace) return;
        setError(null);
        try {
            // Create the conversation, then select it before the refetch
            // resolves so the "auto-select if nothing selected" check above
            // never has a chance to pick a different row instead.
            const { data } = await apiClient.post<CreateAgentConversationResponseDto>(
                "/agent/conversations",
                { workspaceId: workspace.id },
            );
            setSelectedConversationId(data.id);
            await fetchConversations(workspace.id);
        } catch {
            setError("Couldn't start a new conversation.");
        }
    }, [workspace, fetchConversations]);

    // Loads the list whenever the selected workspace changes (including on
    // first mount, once the workspace atom has hydrated). Depends on
    // workspace?.id rather than the workspace object itself so this doesn't
    // re-run on every re-render that hands the atom a new object for the
    // same underlying workspace.
    useEffect(() => {
        if (!workspace) return;
        void fetchConversations(workspace.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspace?.id]);

    return {
        conversations,
        selectedConversationId,
        selectConversation: setSelectedConversationId,
        createConversation,
        isLoading,
        error,
    };
};

export default useAgentConversations;
