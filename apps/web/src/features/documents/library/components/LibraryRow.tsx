import { Link, useNavigate } from "react-router-dom";
import { LuEllipsis, LuFile, LuPin } from "react-icons/lu";
import type { LibraryDocumentDto } from "@converge/shared";
import { cn } from "@/lib/utils";
import { formatAccessLevel, timeAgo } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import {
    ContextMenu,
    DropdownMenu,
    type MenuEntry,
} from "@/components/ui/Menu";
import { RowActions, TableCell, TableRow } from "@/components/common/Table";

/**
 * Relative time with a leading capital, for a table cell ("Just now", "3h ago").
 * @param date - the time to describe
 */
const capitalizedTimeAgo = (date: Date | string) => {
    const text = timeAgo(date);
    return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * One row of the Library table (pp 29 / 30): title, your access, last
 * visited, and last edited. Clicking the row opens the document. At the
 * right edge a pin toggle is always shown — gold when pinned, muted grey
 * when not — followed by a ⋯ menu revealed on hover; a right-click opens the
 * same menu. Below 1024px (phones as in pp 82 / 88, and tablets) the three
 * columns collapse into one line under the title and ⋯ is always shown.
 * @param document - the row's document
 * @param isPinned - whether the user has pinned it to the sidebar
 * @param menuItems - entries of the ⋯ / right-click menu
 * @param onTogglePin - pins the document if unpinned, unpins it otherwise
 */
const LibraryRow = ({
    document,
    isPinned,
    menuItems,
    onTogglePin,
}: {
    document: LibraryDocumentDto;
    isPinned: boolean;
    menuItems: MenuEntry[];
    onTogglePin: () => void;
}) => {
    const navigate = useNavigate();
    const href = `/document/${document.id}`;
    // Phone line under the title: "Owner · visited 3h ago · edited 20h ago".
    const mobileMeta = [
        formatAccessLevel(document.access),
        document.lastVisitedAt && `visited ${timeAgo(document.lastVisitedAt)}`,
        document.lastEditedAt && `edited ${timeAgo(document.lastEditedAt)}`,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <ContextMenu items={menuItems}>
            <TableRow
                onClick={() => navigate(href)}
                className="min-h-[3.25rem] data-[state=open]:bg-surface-hover has-[[data-state=open]]:bg-surface-hover"
            >
                <TableCell>
                    <LuFile className="h-4 w-4 shrink-0 text-fg-muted" />
                    <div className="flex min-w-0 flex-col">
                        {/* A real link, so the row is reachable by keyboard and opens in a new tab on modified clicks */}
                        <Tooltip content={document.title || "Untitled"}>
                            <Link
                                to={href}
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                    "truncate rounded-sm text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
                                    document.title
                                        ? "text-fg"
                                        : "text-fg-muted",
                                )}
                            >
                                {document.title || "Untitled"}
                            </Link>
                        </Tooltip>
                        <span className="truncate text-xs text-fg-muted lg:hidden">
                            {mobileMeta}
                        </span>
                    </div>
                </TableCell>
                <TableCell hideOnMobile>
                    {formatAccessLevel(document.access)}
                </TableCell>
                <TableCell hideOnMobile className="text-fg-muted">
                    {document.lastVisitedAt
                        ? capitalizedTimeAgo(document.lastVisitedAt)
                        : "—"}
                </TableCell>
                <TableCell hideOnMobile className="text-fg-muted">
                    {document.lastEditedAt
                        ? capitalizedTimeAgo(document.lastEditedAt)
                        : "—"}
                </TableCell>
                {/* Clicks here don't reach the row, which opens the document */}
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-end gap-0.5"
                >
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onTogglePin}
                        aria-label={
                            isPinned ? "Unpin document" : "Pin document"
                        }
                        aria-pressed={isPinned}
                        className={cn(
                            isPinned
                                ? "text-gold hover:text-gold"
                                : "text-fg-muted hover:text-fg",
                        )}
                    >
                        <LuPin />
                    </Button>
                    <RowActions className="[@media(max-width:1023px)]:opacity-100">
                        <DropdownMenu
                            items={menuItems}
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Document actions"
                                    className="data-[state=open]:bg-surface-selected"
                                >
                                    <LuEllipsis />
                                </Button>
                            }
                        />
                    </RowActions>
                </div>
            </TableRow>
        </ContextMenu>
    );
};

export default LibraryRow;
