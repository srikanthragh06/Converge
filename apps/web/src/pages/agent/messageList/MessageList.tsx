import type { AgentMessageDto } from "@converge/shared";

/**
 * Renders one conversation's message history. Only 'user' and 'assistant'
 * rows produce a visible bubble — 'tool' rows carry raw tool-call results
 * keyed by toolCallId with no toolName of their own, so instead of a
 * separate unreadable bubble their existence is folded into the preceding
 * assistant row's "✓ Called <toolName>" lines: history is always a
 * completed turn, so every assistant toolCall is guaranteed to have a
 * matching tool row already, unlike a live in-progress stream where a call
 * can still be pending.
 */
const MessageList = ({ messages }: { messages: AgentMessageDto[] }) => (
    <div className="flex flex-col gap-3">
        {messages.map((message, index) => {
            if (message.role === "user")
                return (
                    <div key={index} className="flex justify-end">
                        <div className="max-w-[80%] min-w-0 rounded-md px-3 py-2 bg-accent-blue text-text-white text-sm sm:text-base whitespace-pre-wrap break-words">
                            {message.content}
                        </div>
                    </div>
                );

            if (message.role === "assistant")
                return (
                    <div key={index} className="flex justify-start">
                        <div className="max-w-[80%] min-w-0 rounded-md px-3 py-2 bg-background-elevated text-text-primary text-sm sm:text-base flex flex-col gap-1">
                            {message.text && (
                                <p className="whitespace-pre-wrap break-words">{message.text}</p>
                            )}
                            {message.toolCalls.map((call) => (
                                <p
                                    key={call.toolCallId}
                                    className="text-xs sm:text-sm text-text-disabled"
                                >
                                    ✓ Called <code>{call.toolName}</code>
                                </p>
                            ))}
                        </div>
                    </div>
                );

            // role === 'tool' — no standalone bubble, see the component doc comment above.
            return null;
        })}
    </div>
);

export default MessageList;
