import type { AgentMessageDto } from "@converge/shared";
import type { StreamingStep } from "@/hooks/useAgentStream";
import AnimatedDots from "@/components/AnimatedDots";
import MarkdownText from "./MarkdownText";

/** A single user message bubble, right-aligned. Renders plain text — see MarkdownText's doc comment for why user content isn't formatted as Markdown. */
const UserBubble = ({ content }: { content: string }) => (
    <div className="flex justify-end">
        <div className="max-w-[80%] min-w-0 rounded-md px-3 py-2 bg-accent-blue text-text-white text-sm sm:text-base whitespace-pre-wrap break-words">
            {content}
        </div>
    </div>
);

/**
 * One assistant step's bubble. `status` on a tool call is omitted for
 * persisted history (every call there is guaranteed complete) and
 * 'pending'/'done' for a live streaming step, which renders as a waiting
 * indicator vs. a checkmark.
 */
const AssistantBubble = ({
    text,
    toolCalls,
}: {
    text: string;
    toolCalls: {
        toolCallId: string;
        toolName: string;
        status?: "pending" | "done";
    }[];
}) => (
    <div className="flex justify-start">
        <div className="max-w-[80%] min-w-0 rounded-md px-3 py-2 bg-background-elevated text-text-primary text-sm sm:text-base flex flex-col gap-1">
            {text && <MarkdownText text={text} />}
            {toolCalls.map((call) => (
                <p
                    key={call.toolCallId}
                    className="text-xs sm:text-sm text-text-disabled"
                >
                    {call.status === "pending" ? (
                        <>
                            Calling <code>{call.toolName}</code>
                            <AnimatedDots />
                        </>
                    ) : (
                        <>
                            ✓ Called <code>{call.toolName}</code>
                        </>
                    )}
                </p>
            ))}
            {!text && toolCalls.length === 0 && (
                <p className="text-xs sm:text-sm text-text-disabled">
                    <AnimatedDots />
                </p>
            )}
        </div>
    </div>
);

/**
 * Renders one conversation: its persisted history, plus (while a turn is
 * in flight) the just-sent user message and the live-streaming assistant
 * steps that haven't been persisted yet — see useAgentChat, which supplies
 * pendingUserContent/streamingSteps and clears both once history has
 * caught up. Only 'user' and 'assistant' history rows produce a visible
 * bubble — 'tool' rows carry raw tool-call results keyed by toolCallId
 * with no toolName of their own, so instead of a separate unreadable
 * bubble their existence is folded into the preceding assistant row's
 * "✓ Called <toolName>" lines: history is always a completed turn, so
 * every assistant toolCall is guaranteed to have a matching tool row
 * already.
 */
const MessageList = ({
    messages,
    pendingUserContent,
    streamingSteps,
}: {
    messages: AgentMessageDto[];
    pendingUserContent?: string | null;
    streamingSteps?: StreamingStep[];
}) => (
    <div className="flex flex-col gap-3">
        {/* Persisted history, in insertion order */}
        {messages.map((message, index) => {
            if (message.role === "user") {
                return <UserBubble key={index} content={message.content} />;
            } else if (message.role === "assistant") {
                return (
                    <AssistantBubble
                        key={index}
                        text={message.text}
                        toolCalls={message.toolCalls}
                    />
                );
            } else {
                // role === 'tool' — no standalone bubble, see the component doc comment above.
                return null;
            }
        })}

        {/* The current live turn, not yet persisted: the just-sent user message, then each in-progress assistant step */}
        {pendingUserContent && <UserBubble content={pendingUserContent} />}
        {streamingSteps?.map((step, index) => (
            <AssistantBubble
                key={`streaming-${index}`}
                text={step.text}
                toolCalls={step.toolCalls}
            />
        ))}
    </div>
);

export default MessageList;
