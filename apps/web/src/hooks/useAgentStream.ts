import { useCallback, useEffect, useRef, useState } from "react";

/** One tool call within a streaming step — 'pending' until its matching tool-output-available chunk arrives. */
export type StreamingToolCall = {
    toolCallId: string;
    toolName: string;
    status: "pending" | "done";
};

/** One in-progress step of the turn currently streaming — mirrors how a persisted turn is split one assistant/tool row per step (see AgentMessageDto), so a live turn renders the same shape it'll have once useAgentConversation refetches it. */
export type StreamingStep = {
    text: string;
    toolCalls: StreamingToolCall[];
};

type StreamChunk =
    | { type: "start-step" }
    | { type: "text-delta"; delta: string }
    | { type: "tool-input-available"; toolCallId: string; toolName: string; input: unknown }
    | { type: "tool-output-available"; toolCallId: string; output: unknown }
    | { type: "error"; errorText: string };

/** The subset of StreamChunk that folds into the steps array — 'error' doesn't, it's a separate piece of state, so it's handled by the caller instead. */
type StepChunk = Exclude<StreamChunk, { type: "error" }>;

/**
 * Pure reducer: folds one chunk into the current steps array. Kept outside
 * the hook (no closure over React state) so it's just a plain function of
 * its inputs — sendMessage below calls it as
 * setSteps((prev) => applyChunk(prev, chunk)).
 */
const applyChunk = (steps: StreamingStep[], chunk: StepChunk): StreamingStep[] => {
    if (chunk.type === "start-step") {
        // A new step begins — push an empty one for later text/tool-call chunks to fill in.
        return [...steps, { text: "", toolCalls: [] }];
    } else if (chunk.type === "text-delta") {
        // Only the last step can still be receiving text, so append the fragment there.
        return steps.map((step, i) =>
            i === steps.length - 1 ? { ...step, text: step.text + chunk.delta } : step,
        );
    } else if (chunk.type === "tool-input-available") {
        // The model just decided to call a tool — record it as pending on the last step.
        return steps.map((step, i) =>
            i === steps.length - 1
                ? {
                      ...step,
                      toolCalls: [
                          ...step.toolCalls,
                          {
                              toolCallId: chunk.toolCallId,
                              toolName: chunk.toolName,
                              status: "pending" as const,
                          },
                      ],
                  }
                : step,
        );
    } else {
        // chunk.type === "tool-output-available" — scan every step, not
        // just the last one, since the call being resolved may have been
        // added in an earlier step.
        return steps.map((step) => ({
            ...step,
            toolCalls: step.toolCalls.map((call) =>
                call.toolCallId === chunk.toolCallId ? { ...call, status: "done" as const } : call,
            ),
        }));
    }
};

/**
 * Sends a message into a conversation and parses the server's hand-rolled
 * SSE reply (start-step/text-delta/tool-input-available/
 * tool-output-available/error/[DONE] — see AgentService.sendMessage) into
 * StreamingStep[]. Read-only history (useAgentConversation) and this hook
 * are meant to be composed by useAgentChat, not merged — this hook has no
 * idea what came before the turn it's sending.
 *
 * @param conversationId - The conversation a sent message posts into. sendMessage no-ops if this is null. Switching this while a send is in flight aborts it and clears any partial steps.
 */
const useAgentStream = (conversationId: number | null) => {
    const [steps, setSteps] = useState<StreamingStep[]>([]); // in-progress steps of the turn currently streaming
    const [isStreaming, setIsStreaming] = useState(false); // true while a sendMessage call has an SSE response still open
    const [error, setError] = useState<string | null>(null); // last error message from a failed send, if any (never set for an intentional abort)

    // Guards against chunks from an abandoned stream (superseded by a newer
    // send, or by switching conversations) being applied after the fact —
    // each sendMessage call stamps its own id here.
    const streamIdRef = useRef(0);
    // Holds the in-flight request's AbortController, if any, so switching
    // conversations mid-stream (see the effect below) can cancel it.
    const abortControllerRef = useRef<AbortController | null>(null);

    // Switching conversations aborts whatever was in flight for the
    // previous one and clears its partial state — a stream belongs to the
    // conversation it was sent into, not to whichever one happens to be
    // selected when its chunks arrive.
    useEffect(() => {
        streamIdRef.current++;
        setSteps([]);
        setError(null);
        setIsStreaming(false);
        return () => {
            abortControllerRef.current?.abort();
        };
    }, [conversationId]);

    /**
     * Posts `content` as the next message in the conversation and streams
     * the reply, folding each chunk into `steps` as it arrives. Resolves
     * once the stream ends — successfully, on a real error, or because it
     * was aborted (e.g. by switching conversations) — so a caller that
     * needs to react afterward (useAgentChat refetching real history) can
     * simply await it. No-ops if no conversation is selected.
     *
     * @param content - The message text to send.
     */
    const sendMessage = useCallback(
        async (content: string) => {
            if (conversationId === null) return;

            // Start a new stream, superseding whatever (if anything) was in flight before.
            const streamId = ++streamIdRef.current;
            const controller = new AbortController();
            abortControllerRef.current = controller;

            setSteps([]);
            setError(null);
            setIsStreaming(true);

            const isCurrent = () => streamIdRef.current === streamId;

            try {
                // POST the message and open the SSE reply as a readable byte stream.
                const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/agent/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    signal: controller.signal,
                    body: JSON.stringify({ conversationId, content }),
                });
                if (!res.ok || !res.body) throw new Error(`Request failed: ${res.status}`);

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = ""; // decoded bytes not yet split into a complete "data: ...\n\n" event

                // Read and apply events as they arrive, until the server closes the stream.
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });

                    // Events are separated by a blank line; the last split
                    // entry may be a partial event still waiting on more
                    // bytes, so hold it back for the next read.
                    const events = buffer.split("\n\n");
                    buffer = events.pop() ?? "";

                    for (const event of events) {
                        const line = event.trim();
                        if (!line.startsWith("data: ")) continue;
                        const payload = line.slice("data: ".length);
                        if (payload === "[DONE]") continue;

                        const chunk = JSON.parse(payload) as StreamChunk;
                        if (!isCurrent()) continue;

                        if (chunk.type === "error") {
                            setError(chunk.errorText);
                        } else {
                            setSteps((prev) => applyChunk(prev, chunk));
                        }
                    }
                }
            } catch (err) {
                // An abort (switching conversations mid-stream, see the effect
                // above) is intentional cancellation, not a real failure — only
                // surface genuine errors, and only if this stream is still current.
                const wasAborted = err instanceof DOMException && err.name === "AbortError";
                if (isCurrent() && !wasAborted) {
                    setError("Something went wrong sending that message.");
                }
            } finally {
                if (isCurrent()) setIsStreaming(false);
            }
        },
        [conversationId],
    );

    return {
        steps,
        isStreaming,
        error,
        sendMessage,
        /** Discards the in-progress steps — call once the turn's persisted history has been refetched, so the live bubble isn't shown twice. */
        clearSteps: () => setSteps([]),
    };
};

export default useAgentStream;
