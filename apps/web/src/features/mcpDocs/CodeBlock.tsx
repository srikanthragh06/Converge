import { LuCheck, LuCopy } from "react-icons/lu";
import useCopyToClipboard from "@/hooks/useCopyToClipboard";
import Button from "@/components/ui/Button";

/**
 * Monospace config snippet on an inset panel, with a Copy button in the
 * corner that turns into a gold "Copied" for two seconds. Scrolls
 * sideways rather than wrapping.
 * @param code - the snippet shown and copied
 */
const CodeBlock = ({ code }: { code: string }) => {
    const { copied, copy } = useCopyToClipboard();

    return (
        <div className="relative">
            <pre className="overflow-x-auto whitespace-pre rounded-lg border border-line bg-surface-inset px-4 py-3.5 pr-24 font-mono text-[13px] leading-relaxed text-fg sm:px-5 sm:py-4 sm:text-sm">
                <code>{code}</code>
            </pre>
            <Button
                variant={copied ? "primary" : "secondary"}
                size="sm"
                onClick={() => copy(code)}
                aria-label="Copy snippet"
                className="absolute right-2.5 top-2.5"
            >
                {copied ? <LuCheck /> : <LuCopy />}
                {copied ? "Copied" : "Copy"}
            </Button>
        </div>
    );
};

export default CodeBlock;
