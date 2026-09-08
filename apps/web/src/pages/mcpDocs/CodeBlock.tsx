import { useState } from "react";
import { MdCheck, MdContentCopy } from "react-icons/md";

/**
 * Monospace code snippet with a copy-to-clipboard button in the corner.
 * Mirrors the copy affordance used for the raw API key in RevealApiKeyModal.
 */
const CodeBlock = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false); // True briefly after a successful copy, to swap the button's icon.

    /** Copies the snippet to the clipboard and shows a brief confirmation. */
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy snippet to clipboard:", err);
        }
    };

    return (
        <div className="relative">
            {/* Snippet */}
            <pre
                className="px-2.5 py-2 pr-8 sm:px-3 sm:py-2.5 sm:pr-10 text-[11px] sm:text-sm rounded-md
                    bg-background-elevated border border-border/70 text-text-secondary
                    overflow-x-auto whitespace-pre"
            >
                <code>{code}</code>
            </pre>
            {/* Copy button — icon swaps to a checkmark briefly after a successful copy */}
            <button
                onClick={handleCopy}
                aria-label="Copy snippet"
                className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 p-1 sm:p-1.5 rounded-md bg-background-overlay
                    text-white cursor-pointer hover:opacity-80 active:opacity-70
                    transition shrink-0"
            >
                {copied ? (
                    <MdCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400" />
                ) : (
                    <MdContentCopy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                )}
            </button>
        </div>
    );
};

export default CodeBlock;
