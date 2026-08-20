import { MdOutlineDescription } from "react-icons/md";
import type { TrashDocumentDto } from "@converge/shared";
import { timeAgo } from "../../../utils/utils";

/**
 * Card block representing a single soft-deleted document in the Trash tab.
 * Displays a document icon, title, when it was deleted, and a Restore
 * button. Unlike LibraryDocumentCard, the card itself isn't clickable —
 * a deleted document can't be opened, only restored.
 */
const TrashDocumentCard = ({
    document,
    isRestoring,
    onRestore,
}: {
    document: TrashDocumentDto;
    /** Whether this specific document's restore request is in flight. */
    isRestoring: boolean;
    /** Called with the document ID when the user clicks Restore. */
    onRestore: (id: number) => void;
}) => {
    return (
        <div
            className="flex items-start sm:px-4 sm:py-3 py-2 px-3
            rounded-lg bg-background w-11/12 sm:w-[600px] gap-3"
        >
            <MdOutlineDescription className="w-4 h-4 mt-0.5 shrink-0 opacity-40" />
            <div className="flex flex-col space-y-1 min-w-0 flex-1">
                <span
                    className={`text-white font-medium sm:text-base text-sm truncate leading-tight ${!document.title && "opacity-20"}`}
                >
                    {document.title || "Untitled"}
                </span>
                <div className="flex flex-col space-y-2">
                    <span className="text-white opacity-50 text-xs truncate">
                        Deleted {timeAgo(document.deletedAt)}
                    </span>
                    <button
                        onClick={() => onRestore(document.id)}
                        disabled={isRestoring}
                        className="text-xs text-white hover:opacity-80 transition cursor-pointer text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isRestoring ? "Restoring..." : "Restore"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TrashDocumentCard;
