import { LuCheck, LuCopy } from "react-icons/lu";
import useCopyToClipboard from "@/hooks/useCopyToClipboard";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";

/**
 * A labelled, copyable value on the MCP setup page, e.g. the endpoint or
 * the auth header: muted label, the value in mono, and a Copy button that
 * turns into a gold "Copied" for two seconds.
 * @param label - e.g. "Endpoint"
 * @param value - the text shown and copied
 */
const CopyValueRow = ({ label, value }: { label: string; value: string }) => {
    const { copied, copy } = useCopyToClipboard();

    return (
        <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-elevated px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:py-2">
            <span className="shrink-0 text-xs text-fg-muted sm:w-24">
                {label}
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <Tooltip content={value}>
                    <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg sm:text-sm">
                        {value}
                    </code>
                </Tooltip>
                <Button
                    variant={copied ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => copy(value)}
                    aria-label={`Copy ${label.toLowerCase()}`}
                >
                    {copied ? <LuCheck /> : <LuCopy />}
                    {copied ? "Copied" : "Copy"}
                </Button>
            </div>
        </div>
    );
};

export default CopyValueRow;
