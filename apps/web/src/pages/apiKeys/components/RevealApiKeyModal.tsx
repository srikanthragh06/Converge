import { useState } from "react";
import { MdCheck, MdContentCopy } from "react-icons/md";

/**
 * Modal shown exactly once, immediately after a new API key is created —
 * the raw key is never retrievable again after this closes, since the
 * server only ever stores its hash. No backdrop-click or Escape dismissal;
 * the user must explicitly confirm via the Done button, so the key can't
 * be lost to an accidental click before it's copied.
 */
const RevealApiKeyModal = ({
    rawKey,
    onDone,
}: {
    /** The newly created key's raw value, shown once. */
    rawKey: string;
    /** Called when the user dismisses the dialog via the Done button. */
    onDone: () => void;
}) => {
    const [copied, setCopied] = useState(false); // True briefly after a successful copy, to swap the button's icon/label.

    /**
     * Copies the raw key to the clipboard and shows a brief confirmation.
     * Fails silently on the button (falls back to console) if the browser
     * denies clipboard access — the key is still visible and selectable in
     * the field above either way.
     */
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(rawKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy API key to clipboard:", err);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
            {/* Dialog panel */}
            <div className="bg-background-base rounded-xl px-6 py-5 w-full max-w-md mx-4 flex flex-col gap-4">
                <h2 className="text-white text-lg font-semibold">
                    Your new API key
                </h2>

                <p className="text-sm text-red-400">
                    Copy this key now — you won't be able to see it again.
                </p>

                {/* Raw key display with copy button */}
                <div className="flex items-center gap-2">
                    <code
                        className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm rounded-md
                            bg-background-elevated border border-border/70 text-white
                            overflow-x-auto whitespace-nowrap"
                    >
                        {rawKey}
                    </code>
                    <button
                        onClick={handleCopy}
                        aria-label="Copy API key"
                        className="p-2 rounded-md bg-background-elevated border border-border/70
                            text-white cursor-pointer hover:opacity-80 active:opacity-70
                            transition shrink-0"
                    >
                        {copied ? (
                            <MdCheck className="w-4 h-4 text-green-400" />
                        ) : (
                            <MdContentCopy className="w-4 h-4" />
                        )}
                    </button>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={onDone}
                        className="px-3 py-1.5 text-sm rounded-md bg-white
                            text-black border-none cursor-pointer
                            hover:opacity-80 active:opacity-70 transition"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RevealApiKeyModal;
