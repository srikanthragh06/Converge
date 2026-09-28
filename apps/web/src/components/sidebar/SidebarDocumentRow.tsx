import { LuFile, LuPin } from "react-icons/lu";
import type { LibraryDocumentDto } from "@converge/shared";
import { cn } from "../../lib/utils";

/**
 * Single row in the sidebar's Pinned or Recent section: a document title
 * that opens it, plus a pin/unpin button revealed on hover or focus.
 */
const SidebarDocumentRow = ({
    doc,
    isPinned,
    isActive,
    onOpen,
    onTogglePin,
}: {
    /** The document this row represents. */
    doc: LibraryDocumentDto;
    /** Whether doc is currently pinned — the pin shows gold, and clicking it unpins. */
    isPinned: boolean;
    /** Whether doc is the one open in the editor; shows the selected fill. */
    isActive: boolean;
    /** Navigates to the document. */
    onOpen: () => void;
    /** Pins doc if it's currently unpinned, unpins it otherwise. */
    onTogglePin: () => void;
}) => (
    <div
        className={cn(
            "group/doc relative flex h-8 shrink-0 items-center rounded-md transition-colors",
            isActive ? "bg-surface-selected" : "hover:bg-surface-hover",
        )}
    >
        <button
            type="button"
            onClick={onOpen}
            aria-current={isActive ? "page" : undefined}
            className={cn(
                "flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md pl-2.5 pr-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-gold/60 group-hover/doc:pr-9 group-focus-within/doc:pr-9",
                isActive ? "text-fg" : "text-fg-secondary",
            )}
        >
            <LuFile className="h-4 w-4 shrink-0 text-fg-muted" />
            <span className={cn("truncate", !doc.title && "text-fg-muted")}>
                {doc.title || "Untitled"}
            </span>
        </button>
        <button
            type="button"
            onClick={onTogglePin}
            aria-label={isPinned ? "Unpin document" : "Pin document"}
            className={cn(
                "absolute right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded opacity-0 outline-none transition-opacity hover:bg-surface-selected focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-gold/60 group-hover/doc:opacity-100 [@media(hover:none)]:opacity-100",
                isPinned ? "text-gold" : "text-fg-muted hover:text-fg",
            )}
        >
            <LuPin className="h-3.5 w-3.5" />
        </button>
    </div>
);

export default SidebarDocumentRow;
