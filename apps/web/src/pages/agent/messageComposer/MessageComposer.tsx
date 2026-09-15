import { useState } from "react";
import { MdSend } from "react-icons/md";
import { AGENT_MESSAGE_MAX_LENGTH } from "@converge/shared";

/**
 * Text input + send button for the agent chat. Enter sends, Shift+Enter
 * inserts a newline. Disabled while a turn is streaming, since the agent
 * loop is one turn at a time per conversation — no queuing a second
 * message mid-turn.
 */
const MessageComposer = ({
    onSend,
    disabled,
}: {
    /** Called with the trimmed message content on send. */
    onSend: (content: string) => void;
    /** True while a turn is already streaming, or no conversation is selected. */
    disabled: boolean;
}) => {
    const [content, setContent] = useState(""); // the composer's current draft text

    /**
     * Trims and sends the current draft via onSend, then clears the
     * input. No-ops on an empty/whitespace-only draft or while disabled.
     */
    const handleSend = () => {
        const trimmed = content.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setContent("");
    };

    return (
        // Draft input + send button
        <div className="shrink-0 flex items-end gap-2 border-t border-border px-3 sm:px-6 py-3">
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                    // isComposing is true while an IME (e.g. Japanese/Chinese
                    // input) is mid-composition — the Enter that confirms a
                    // composed character also fires a keydown event, and
                    // without this check it would send the draft prematurely
                    // instead of just confirming the character.
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                disabled={disabled}
                maxLength={AGENT_MESSAGE_MAX_LENGTH}
                rows={1}
                placeholder="Message the agent…"
                className="flex-1 min-w-0 resize-none px-3 py-2 text-sm sm:text-base rounded-md
                    bg-background-base outline-none text-text-primary border border-border/70
                    focus:border-white/30 transition placeholder:text-text-disabled
                    disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
                onClick={handleSend}
                disabled={disabled || !content.trim()}
                aria-label="Send message"
                className="shrink-0 p-2 rounded-md bg-accent-blue text-text-white
                    hover:opacity-80 active:opacity-70 transition cursor-pointer
                    disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <MdSend className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
        </div>
    );
};

export default MessageComposer;
