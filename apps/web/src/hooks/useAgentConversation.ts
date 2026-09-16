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
    const [isLoading, setIsLoading] = useState(false); // true only while a caller has asked to show it — a first load or a conversation switch; never a background refetch
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
     * the meantime. showLoading is the caller's own call, not inferred from
     * current state — the effect below (a first load or conversation
     * switch, with nothing relevant on screen yet) always wants it;
     * refetch() (pulling in a turn's persisted version right after it
     * streamed) never does, since useAgentChat already has that turn's
     * content showing live via pendingUserContent/streamingSteps, even on a
     * brand-new conversation's very first message.
     *
     * @param id - The conversation id to fetch history for.
     * @param showLoading - Whether to surface the loading state for this fetch.
     */
    const fetchMessages = useCallback(async (id: number, showLoading: boolean) => {
        const requestId = ++requestIdRef.current;
        if (showLoading) setIsLoading(true);
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

    // Loads history whenever the selected conversation changes. Clears any
    // previous conversation's messages first — not just on switching to
    // "nothing selected" — so a switch between two real conversations never
    // flashes the old one's messages while the new one is still loading.
    useEffect(() => {
        if (conversationId === null) {
            requestIdRef.current++; // invalidate any fetch still in flight for the previous conversation
            setMessages([]);
            setError(null);
            return;
        }
        setMessages([]);
        void fetchMessages(conversationId, true);
    }, [conversationId, fetchMessages]);

    return {
        messages,
        isLoading,
        error,
        /** Re-pulls the current conversation's history from the server, without surfacing a loading state. No-ops when nothing is selected. */
        refetch: () =>
            conversationId === null ? Promise.resolve() : fetchMessages(conversationId, false),
    };
};

export default useAgentConversation;
