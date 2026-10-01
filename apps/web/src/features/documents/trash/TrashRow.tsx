import { LuFile, LuRotateCcw } from "react-icons/lu";
import type { TrashDocumentDto } from "@converge/shared";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { RowActions, TableCell, TableRow } from "@/components/common/Table";

/**
 * One row of the Trash table: document title, when it was deleted, and a
 * Restore button revealed on hover (always shown on touch screens). The row
 * itself isn't clickable — a deleted document can't be opened, only restored.
 * Below 1024px (phones, tablets) the deleted time moves under the title.
 * @param document - the trashed document
 * @param isRestoring - whether this document's restore request is in flight
 * @param onRestore - restores the document
 */
const TrashRow = ({
    document,
    isRestoring,
    onRestore,
}: {
    document: TrashDocumentDto;
    isRestoring: boolean;
    onRestore: (document: TrashDocumentDto) => void;
}) => (
    <TableRow>
        <TableCell>
            <LuFile className="h-4 w-4 shrink-0 text-fg-muted" />
            <div className="flex min-w-0 flex-col">
                <span
                    className={cn(
                        "truncate text-[15px]",
                        document.title ? "text-fg" : "text-fg-muted",
                    )}
                >
                    {document.title || "Untitled"}
                </span>
                <span className="truncate text-xs text-fg-muted lg:hidden">
                    Deleted {timeAgo(document.deletedAt)}
                </span>
            </div>
        </TableCell>
        <TableCell hideOnMobile className="text-fg-muted">
            {timeAgo(document.deletedAt)}
        </TableCell>
        <RowActions className={cn(isRestoring && "opacity-100")}>
            <Button
                size="sm"
                onClick={() => onRestore(document)}
                disabled={isRestoring}
                className="sm:h-8 sm:px-3 sm:text-sm"
            >
                <LuRotateCcw />
                {isRestoring ? "Restoring…" : "Restore"}
            </Button>
        </RowActions>
    </TableRow>
);

export default TrashRow;
