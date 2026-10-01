import { LuEllipsis, LuFile, LuPin } from "react-icons/lu";
import type { LibraryDocumentDto } from "@converge/shared";
import { cn } from "@/lib/utils";
import {
    ContextMenu,
    DropdownMenu,
    type MenuEntry,
} from "@/components/ui/Menu";

/** Classes for the small square buttons revealed at the row's right edge. */
const ACTION_BUTTON_CLASSES =
    "flex h-6 w-6 cursor-pointer items-center justify-center rounded outline-none transition-colors hover:bg-surface-selected focus-visible:ring-2 focus-visible:ring-gold/60 data-[state=open]:bg-surface-selected [&_svg]:h-3.5 [&_svg]:w-3.5";

/**
 * Single row in the sidebar's Pinned or Recent section: a document title
 * that opens it, with pin and ⋯ buttons revealed on hover or focus (always
 * shown on touch screens, which have no hover). The ⋯ button and a
 * right-click (long-press on touch) open the same menu.
 */
const SidebarDocumentRow = ({
    doc,
    isPinned,
    isActive,
    menuItems,
    onOpen,
    onTogglePin,
}: {
    /** The document this row represents. */
    doc: LibraryDocumentDto;
    /** Whether doc is currently pinned — the pin shows gold, and clicking it unpins. */
    isPinned: boolean;
    /** Whether doc is the one open in the editor; shows the selected fill. */
    isActive: boolean;
    /** Rows of the ⋯ / right-click menu. */
    menuItems: MenuEntry[];
    /** Navigates to the document. */
    onOpen: () => void;
    /** Pins doc if it's currently unpinned, unpins it otherwise. */
    onTogglePin: () => void;
}) => (
    <ContextMenu items={menuItems}>
        <div
            className={cn(
                "group/doc relative flex h-8 shrink-0 items-center rounded-md transition-colors data-[state=open]:bg-surface-hover",
                isActive ? "bg-surface-selected" : "hover:bg-surface-hover",
            )}
        >
            <button
                type="button"
                onClick={onOpen}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                    "flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md pl-2.5 pr-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-gold/60 group-focus-within/doc:pr-16 group-hover/doc:pr-16 group-has-[[data-state=open]]/doc:pr-16 [@media(hover:none)]:pr-16",
                    isActive ? "text-fg" : "text-fg-secondary",
                )}
            >
                <LuFile className="h-4 w-4 shrink-0 text-fg-muted" />
                <span className={cn("truncate", !doc.title && "text-fg-muted")}>
                    {doc.title || "Untitled"}
                </span>
            </button>
            {/* Hover actions — also shown while focused inside, while the ⋯ menu is open, and always on touch screens */}
            <div className="absolute right-1 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/doc:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">
                <button
                    type="button"
                    onClick={onTogglePin}
                    aria-label={isPinned ? "Unpin document" : "Pin document"}
                    className={cn(
                        ACTION_BUTTON_CLASSES,
                        isPinned ? "text-gold" : "text-fg-muted hover:text-fg",
                    )}
                >
                    <LuPin />
                </button>
                <DropdownMenu
                    align="start"
                    items={menuItems}
                    trigger={
                        <button
                            type="button"
                            aria-label="Document actions"
                            className={cn(
                                ACTION_BUTTON_CLASSES,
                                "text-fg-muted hover:text-fg",
                            )}
                        >
                            <LuEllipsis />
                        </button>
                    }
                />
            </div>
        </div>
    </ContextMenu>
);

export default SidebarDocumentRow;
