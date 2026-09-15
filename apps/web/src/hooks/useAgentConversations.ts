import { useCallback, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import apiClient from "@/lib/http";
import type {
    CreateAgentConversationResponseDto,
    GetAgentConversationsResponseDto,
} from "@converge/shared";

/** One conversation as returned by the list/create endpoints. title is null for an untitled conversation, in which case a row falls back to its formatted creation date. */
export type AgentConversationSummary = CreateAgentConversationResponseDto;

/**
 * Lists the current workspace's agent conversations and tracks which one is
 * selected, plus create/rename/delete. Deliberately scoped to conversation
 * metadata only — no message history or chat sending here, that's
 * useAgentChat's job. Selection is plain local state with no persistence
 * across a reload beyond the auto-select-most-recent behavior below.
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

    /**
     * Renames a conversation, then refetches the list so the new title shows
     * up immediately. Selection is untouched — renaming never changes what's
     * selected.
     *
     * @param conversationId - The conversation to rename.
     * @param title - The new title.
     */
    const renameConversation = useCallback(
        async (conversationId: number, title: string) => {
            if (!workspace) return;
            setError(null);
            try {
                await apiClient.patch(`/agent/conversations/${conversationId}`, { title });
                await fetchConversations(workspace.id);
            } catch {
                setError("Couldn't rename the conversation.");
            }
        },
        [workspace, fetchConversations],
    );

    /**
     * Deletes a conversation, then refetches the list. If the deleted
     * conversation was selected, clears the selection first so the
     * "auto-select if nothing selected" logic in fetchConversations picks
     * the next most-recent one instead of leaving a dangling reference to a
     * row that's about to disappear.
     *
     * @param conversationId - The conversation to delete.
     */
    const deleteConversation = useCallback(
        async (conversationId: number) => {
            if (!workspace) return;
            setError(null);
            try {
                await apiClient.delete(`/agent/conversations/${conversationId}`);
                setSelectedConversationId((current) =>
                    current === conversationId ? null : current,
                );
                await fetchConversations(workspace.id);
            } catch {
                setError("Couldn't delete the conversation.");
            }
        },
        [workspace, fetchConversations],
    );

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
        renameConversation,
        deleteConversation,
        isLoading,
        error,
    };
};

export default useAgentConversations;
