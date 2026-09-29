import { useState } from "react";
import { LuArrowRight, LuCheck, LuCopy, LuTriangleAlert } from "react-icons/lu";
import Modal from "../../../components/ui/Modal";
import ModalFooter from "../../../components/ui/ModalFooter";
import Button from "../../../components/ui/Button";

/**
 * Shown once, right after a key is created (pp 35 / 43): the full key with
 * a Copy button, a warning that it's never shown again (the server keeps
 * only its hash), a link on to MCP setup, and I've saved it. Escape and
 * backdrop clicks are ignored, so the key can't be lost to a stray click
 * before it's copied; the close button counts as I've saved it.
 * @param label - the new key's name
 * @param rawKey - the full key
 * @param onDone - closes the dialog
 * @param onOpenMcpSetup - closes the dialog and opens MCP setup
 */
const RevealApiKeyModal = ({
    label,
    rawKey,
    onDone,
    onOpenMcpSetup,
}: {
    label: string;
    rawKey: string;
    onDone: () => void;
    onOpenMcpSetup: () => void;
}) => {
    const [copied, setCopied] = useState(false); // true briefly after a successful copy

    /**
     * Copies the key to the clipboard and shows Copied for two seconds. If
     * the browser denies clipboard access the key is still selectable.
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
        <Modal
            onClose={onDone}
            title="Copy your new key"
            description={`"${label}" is ready.`}
            dismissible={false}
            size="md"
            className="sm:max-w-[34rem]"
        >
            <div className="mt-2 flex items-center gap-3 rounded-lg border border-gold bg-surface-inset py-2 pl-4 pr-2">
                <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap font-mono text-sm text-fg">
                    {rawKey}
                </code>
                <Button variant="primary" onClick={handleCopy}>
                    {copied ? <LuCheck /> : <LuCopy />}
                    {copied ? "Copied" : "Copy"}
                </Button>
            </div>
            <div className="mt-4 flex gap-2.5 rounded-lg bg-surface-selected px-4 py-3 text-sm text-fg-secondary">
                <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <span>
                    This is the only time the full key is shown. If you lose it,
                    revoke it and create a new one.
                </span>
            </div>
            <button
                type="button"
                onClick={onOpenMcpSetup}
                className="mt-5 flex cursor-pointer items-center gap-1.5 self-start rounded-sm text-sm text-gold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-gold/60"
            >
                Next: connect your agent in MCP setup
                <LuArrowRight className="h-4 w-4" />
            </button>
            <ModalFooter>
                <Button variant="primary" onClick={onDone}>
                    I've saved it
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default RevealApiKeyModal;
