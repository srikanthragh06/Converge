import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "@/lib/http";
import type { AgentMessageDto, GetAgentMessagesResponseDto } from "@converge/shared";

/**
 * Fetches and holds one conversation's message history, re-fetching
 * whenever the given conversation id changes, and exposes refetch() so a
 * caller (useAgentChat, once a live turn finishes) can pull the
 * now-persisted version of a turn that was rendered live via
 * useAgentStream. This hook only reads — it never drives a live send.
 *
 * @param conversationId - The conversation to load history for, or null when nothing is selected yet.
 */
const useAgentConversation = (conversationId: number | null) => {
    const [messages, setMessages] = useState<AgentMessageDto[]>([]); // the conversation's messages, in insertion order, as returned by the server
    const [isLoading, setIsLoading] = useState(false); // true while history is being (re)fetched
    const [error, setError] = useState<string | null>(null); // last fetch failure message, if any

    // Guards against a stale fetch overwriting state after a newer one has
    // started (either a manual refetch or a conversation change) — every
    // fetch stamps its own id here and only applies its result if it's
    // still the most recent one in flight.
    const requestIdRef = useRef(0);

    /**
     * Fetches the given conversation's message history and applies it to
     * state, unless a newer fetch (a manual refetch, or the effect below
     * firing again for a subsequent conversation change) has started in
     * the meantime.
     *
     * @param id - The conversation id to fetch history for.
     */
    const fetchMessages = useCallback(async (id: number) => {
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await apiClient.get<GetAgentMessagesResponseDto>(
                `/agent/conversations/${id}/messages`,
            );
            if (requestIdRef.current === requestId) setMessages(data.messages);
        } catch {
            if (requestIdRef.current === requestId)
                setError("Couldn't load this conversation's messages.");
        } finally {
            if (requestIdRef.current === requestId) setIsLoading(false);
        }
    }, []);

    // Loads history whenever the selected conversation changes.
    useEffect(() => {
        if (conversationId === null) {
            requestIdRef.current++; // invalidate any fetch still in flight for the previous conversation
            setMessages([]);
            setError(null);
            return;
        }
        void fetchMessages(conversationId);
    }, [conversationId, fetchMessages]);

    return {
        messages,
        isLoading,
        error,
        /** Re-pulls the current conversation's history from the server. No-ops when nothing is selected. */
        refetch: () =>
            conversationId === null ? Promise.resolve() : fetchMessages(conversationId),
    };
};

export default useAgentConversation;
