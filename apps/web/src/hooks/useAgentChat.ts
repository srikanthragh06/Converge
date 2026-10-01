import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import { agentKeys } from "@/queries/agent";
import { documentKeys } from "@/queries/documents";
import useAgentConversation from "./useAgentConversation";
import useAgentStream from "./useAgentStream";

/**
 * Composes useAgentConversation (history) and useAgentStream (live send)
 * into one conversation view — persisted messages, an optimistically-shown
 * user message plus the in-progress assistant steps while a turn is
 * streaming, and a send() that clears both once the turn's real history
 * has been refetched. See the AI agent chat plan discussion for why this
 * is a composition of two narrow hooks rather than one hook owning
 * everything.
 *
 * @param conversationId - The conversation to load and chat in, or null when nothing is selected yet.
 */
const useAgentChat = (conversationId: number | null) => {
    const {
        messages,
        isLoading: isLoadingHistory,
        error: historyError,
        refetch,
    } = useAgentConversation(conversationId);
    const {
        steps: streamingSteps,
        isStreaming,
        error: streamError,
        sendMessage,
        clearSteps,
        stop,
    } = useAgentStream(conversationId);

    // The user's just-sent content, shown immediately rather than waiting
    // for the turn to finish and history to refetch. Cleared once refetch
    // resolves, alongside the live steps, so the persisted version takes
    // over without a duplicate or a flicker of emptiness.
    const [pendingUserContent, setPendingUserContent] = useState<string | null>(
        null,
    );
    const queryClient = useQueryClient();
    const workspace = useAtomValue(currentWorkspaceAtom);

    /**
     * Sends `content` as the next user message: shows it immediately as
     * pendingUserContent, streams the assistant's reply live via
     * useAgentStream, then — once the stream ends — refetches the turn's
     * real persisted history and clears both the optimistic user message
     * and the live steps, so the persisted version takes over cleanly. Also
     * refreshes the conversation list (the order is newest-used first) and
     * the document lists, since agent tools can create, rename or trash
     * documents.
     * Not wrapped in useCallback: refetch and clearSteps are fresh
     * function references on every render of their source hooks anyway
     * (neither is memoized there), so memoizing this one wouldn't make it
     * referentially stable — it would just add a useCallback with no
     * effect.
     *
     * @param content - The message text to send.
     * @param targetId - The conversation to send into (default: the current one) — e.g. one just created for this message, before this closure has caught up with the new selection.
     */
    const send = async (
        content: string,
        targetId: number | null = conversationId,
    ) => {
        setPendingUserContent(content);
        await sendMessage(content, targetId);
        queryClient.invalidateQueries({
            queryKey: agentKeys.conversations(workspace?.id ?? 0),
        });
        queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        await refetch(targetId);
        clearSteps();
        setPendingUserContent(null);
    };

    return {
        messages,
        pendingUserContent,
        streamingSteps,
        isLoadingHistory,
        isStreaming,
        error: historyError ?? streamError,
        send,
        /** Stops the reply in flight; send() then refetches what the server saved, as after any turn. */
        stop,
    };
};

export default useAgentChat;
