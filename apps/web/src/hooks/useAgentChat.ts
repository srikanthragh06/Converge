import { useState } from "react";
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
    } = useAgentStream(conversationId);

    // The user's just-sent content, shown immediately rather than waiting
    // for the turn to finish and history to refetch. Cleared once refetch
    // resolves, alongside the live steps, so the persisted version takes
    // over without a duplicate or a flicker of emptiness.
    const [pendingUserContent, setPendingUserContent] = useState<string | null>(null);

    /**
     * Sends `content` as the next user message: shows it immediately as
     * pendingUserContent, streams the assistant's reply live via
     * useAgentStream, then — once the stream ends — refetches the turn's
     * real persisted history and clears both the optimistic user message
     * and the live steps, so the persisted version takes over cleanly.
     * Not wrapped in useCallback: refetch and clearSteps are fresh
     * function references on every render of their source hooks anyway
     * (neither is memoized there), so memoizing this one wouldn't make it
     * referentially stable — it would just add a useCallback with no
     * effect.
     *
     * @param content - The message text to send.
     */
    const send = async (content: string) => {
        setPendingUserContent(content);
        await sendMessage(content);
        await refetch();
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
    };
};

export default useAgentChat;
