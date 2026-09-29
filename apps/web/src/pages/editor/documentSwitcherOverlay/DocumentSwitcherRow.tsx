import { LuFile } from "react-icons/lu";
import { cn } from "../../../lib/utils";

/**
 * One document in the search palette: a file icon and the title. The
 * keyboard-focused row gets the selected fill and an "Open ↵" hint; other
 * rows get a lighter hover fill.
 * @param title - the document's title; empty renders a muted "Untitled"
 * @param isFocused - whether this row is the keyboard-focused one (Enter opens it)
 * @param onClick - opens the document
 */
const DocumentSwitcherRow = ({
    title,
    isFocused,
    onClick,
}: {
    title: string;
    isFocused: boolean;
    onClick: () => void;
}) => (
    <div
        onClick={onClick}
        className={cn(
            "flex h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 transition-colors",
            isFocused ? "bg-surface-selected" : "hover:bg-surface-hover",
        )}
    >
        <LuFile className="h-4 w-4 shrink-0 text-fg-muted" />
        <span
            className={cn(
                "min-w-0 flex-1 truncate text-[15px]",
                title ? "text-fg" : "text-fg-muted",
            )}
        >
            {title || "Untitled"}
        </span>
        {isFocused && (
            <span className="hidden shrink-0 text-xs text-fg-muted sm:inline">
                Open ↵
            </span>
        )}
    </div>
);

export default DocumentSwitcherRow;
