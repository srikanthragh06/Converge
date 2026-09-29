import { useLayoutEffect, useRef, useState } from "react";
import { LuArrowUp } from "react-icons/lu";
import { AGENT_MESSAGE_MAX_LENGTH } from "@converge/shared";
import Button from "../ui/Button";
import useIsMobile from "../../hooks/useIsMobile";

/** Tallest the message field grows (px) before it scrolls. */
const MAX_HEIGHT = 200;

/**
 * Message field at the bottom of the Ask Converge panel (pp 67 / 81): a
 * bordered box that grows with the text, a gold send button, and (desktop
 * only) the note that edits save a checkpoint first. Enter sends and
 * Shift+Enter adds a line. Sending is blocked while a reply streams, since
 * the agent runs one turn at a time per conversation.
 * @param onSend - called with the trimmed message
 * @param disabled - true while a reply streams or a new conversation is being created
 */
const MessageComposer = ({
    onSend,
    disabled,
}: {
    onSend: (content: string) => void;
    disabled: boolean;
}) => {
    const [content, setContent] = useState(""); // the draft
    const textareaRef = useRef<HTMLTextAreaElement>(null); // resized to fit the draft
    const isMobile = useIsMobile(); // phones get the short placeholder (p81)

    // Grows the field with its text, up to MAX_HEIGHT.
    useLayoutEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    }, [content]);

    /** Sends the trimmed draft and clears it; no-op when empty or disabled. */
    const handleSend = () => {
        const trimmed = content.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setContent("");
    };

    return (
        <div className="shrink-0 border-t border-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface-elevated py-2.5 pl-4 pr-2.5 transition-colors focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20">
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => {
                        // An IME's composition-confirming Enter must not send the draft.
                        if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.nativeEvent.isComposing
                        ) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    maxLength={AGENT_MESSAGE_MAX_LENGTH}
                    rows={1}
                    aria-label="Message Ask Converge"
                    className="min-h-[2.25rem] min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-[15px] leading-normal text-fg outline-none placeholder:text-fg-muted"
                    placeholder={
                        isMobile
                            ? "Ask Converge…"
                            : "Ask about your documents, or tell Converge what to change…"
                    }
                />
                <Button
                    variant="primary"
                    onClick={handleSend}
                    disabled={disabled || !content.trim()}
                    aria-label="Send message"
                    className="h-9 w-9 rounded-lg px-0 [&_svg]:h-[18px] [&_svg]:w-[18px]"
                >
                    <LuArrowUp />
                </Button>
            </div>
            <p className="mt-2 hidden px-1 text-xs text-fg-muted sm:block">
                Edits save a checkpoint first, so you can always restore.
            </p>
        </div>
    );
};

export default MessageComposer;
