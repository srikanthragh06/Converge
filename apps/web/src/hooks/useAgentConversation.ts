import { useEffect, useState } from "react";
import apiClient from "@/lib/http";
import type { AgentMessageDto, GetAgentMessagesResponseDto } from "@converge/shared";

/**
 * Fetches and holds one conversation's message history, re-fetching whenever
 * the given conversation id changes. Read-only for now — no live sending or
 * SSE parsing, that's useAgentStream's job once it exists; this hook and
 * that one are meant to be composed by a thin top-level hook later, not
 * merged into one (see the AI agent chat plan discussion).
 *
 * @param conversationId - The conversation to load history for, or null when nothing is selected yet.
 */
const useAgentConversation = (conversationId: number | null) => {
    const [messages, setMessages] = useState<AgentMessageDto[]>([]); // the conversation's messages, in insertion order, as returned by the server
    const [isLoading, setIsLoading] = useState(false); // true while history is being (re)fetched
    const [error, setError] = useState<string | null>(null); // last fetch failure message, if any

    // Loads history whenever the selected conversation changes. Guards
    // against a stale response landing after a quick re-select (e.g.
    // clicking conversation A then B before A's fetch resolves) by checking
    // a per-effect cancelled flag before applying the result.
    useEffect(() => {
        if (conversationId === null) {
            setMessages([]);
            setError(null);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        const fetchMessages = async () => {
            try {
                const { data } = await apiClient.get<GetAgentMessagesResponseDto>(
                    `/agent/conversations/${conversationId}/messages`,
                );
                if (!cancelled) setMessages(data.messages);
            } catch {
                if (!cancelled) setError("Couldn't load this conversation's messages.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        void fetchMessages();

        return () => {
            cancelled = true;
        };
    }, [conversationId]);

    return { messages, isLoading, error };
};

export default useAgentConversation;
