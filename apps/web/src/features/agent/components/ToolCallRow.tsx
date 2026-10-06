import { LuCheck, LuLoaderCircle } from "react-icons/lu";

/**
 * One tool call in an assistant step (pp 67 / 68): a green check and
 * "Called" once it has finished, or a spinner and "Calling" while it runs,
 * then the tool name as code.
 * @param toolName - the tool's name, e.g. "searchDocuments"
 * @param pending - true while the call is still running
 */
const ToolCallRow = ({
    toolName,
    pending,
}: {
    toolName: string;
    pending?: boolean;
}) => (
    <p className="flex items-center gap-2 text-[13px] leading-[1.6]">
        {pending ? (
            <LuLoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-fg-muted" />
        ) : (
            <LuCheck className="h-3.5 w-3.5 shrink-0 text-success" />
        )}
        <span className={pending ? "text-fg" : "text-fg-muted"}>
            {pending ? "Calling" : "Called"}
        </span>
        <code className="rounded bg-surface-hover px-1.5 py-px font-mono text-xs text-fg-secondary">
            {toolName}
        </code>
    </p>
);

export default ToolCallRow;
