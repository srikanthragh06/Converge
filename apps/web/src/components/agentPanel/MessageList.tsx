import { useLayoutEffect, useRef } from "react";
import type { AgentMessageDto } from "@converge/shared";
import type { StreamingStep } from "../../hooks/useAgentStream";
import AssistantStep from "./AssistantStep";
import StreamingCursor from "./StreamingCursor";
import UserMessage from "./UserMessage";

/** How close to the bottom (px) still counts as "at the bottom" for following a streaming reply. */
const STICK_THRESHOLD = 80;

/**
 * The open conversation, scrolling on its own: persisted history, then
 * (while a turn is in flight) the just-sent message and the live assistant
 * steps not yet persisted — see useAgentChat, which clears both once
 * history catches up. Only "user" and "assistant" rows render; a "tool" row
 * holds a raw result with no tool name, so it's represented by the
 * preceding assistant step's "Called <tool>" row instead. Opens scrolled to
 * the bottom and follows new content while the reader is at the bottom.
 * @param messages - persisted history, in order
 * @param pendingUserContent - the just-sent message, until history has it
 * @param streamingSteps - the live turn's steps
 * @param isStreaming - true while a reply is streaming: shows the gold cursor
 * @param onFollowLink - called when a document link opens in the app
 */
const MessageList = ({
    messages,
    pendingUserContent,
    streamingSteps,
    isStreaming,
    onFollowLink,
}: {
    messages: AgentMessageDto[];
    pendingUserContent: string | null;
    streamingSteps: StreamingStep[];
    isStreaming: boolean;
    onFollowLink: () => void;
}) => {
    const scrollRef = useRef<HTMLDivElement>(null); // the scrolling container
    const stickRef = useRef(true); // whether the reader is at the bottom, so new content should scroll into view

    // Keeps the newest content in view while the reader is at the bottom
    // (always true on first render, so a conversation opens at its end).
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (el && stickRef.current) el.scrollTop = el.scrollHeight;
    });

    const lastStep = streamingSteps[streamingSteps.length - 1];

    return (
        <div
            ref={scrollRef}
            onScroll={(e) => {
                const el = e.currentTarget;
                stickRef.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight <
                    STICK_THRESHOLD;
            }}
            className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-[22px]"
        >
            {/* Persisted history */}
            {messages.map((message, index) =>
                message.role === "user" ? (
                    <UserMessage key={index} content={message.content} />
                ) : message.role === "assistant" ? (
                    <AssistantStep
                        key={index}
                        text={message.text}
                        toolCalls={message.toolCalls}
                        onFollowLink={onFollowLink}
                    />
                ) : null,
            )}

            {/* The live turn: the just-sent message, then each step so far */}
            {pendingUserContent && <UserMessage content={pendingUserContent} />}
            {streamingSteps.map((step, index) => (
                <AssistantStep
                    key={`streaming-${index}`}
                    text={step.text}
                    toolCalls={step.toolCalls}
                    streaming={isStreaming && step === lastStep}
                    onFollowLink={onFollowLink}
                />
            ))}
            {/* Thinking, before the first step arrives */}
            {isStreaming && !lastStep && <StreamingCursor />}
        </div>
    );
};

export default MessageList;
