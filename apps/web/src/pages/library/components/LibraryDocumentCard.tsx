import type { LibraryDocumentDto } from "@converge/shared";
import { timeAgo } from "../../../utils/utils";

/**
 * Card block representing a single document in the library grid.
 * Displays the document title and a metadata row with owner name,
 * last-visited time, and last-edited time.
 */
const LibraryDocumentCard = ({
    document,
}: {
    document: LibraryDocumentDto;
}) => {
    const meta = [
        document.ownerName,
        `Last visited ${timeAgo(document.lastVisitedAt)}`,
        `Edited ${timeAgo(document.lastEditedAt)}`,
    ];

    return (
        <div
            className="flex flex-col sm:gap-2 gap-1 sm:px-4 sm:py-2 py-2 px-3 
        rounded-lg bg-background cursor-pointer 
        hover:opacity-80 active:opacity-70 transition w-11/12 sm:w-[600px]"
        >
            <span
                className={`text-white font-medium sm:text-xl text-base truncate ${!document.title && "text-opacity-20"}`}
            >
                {document.title || "Untitled"}
            </span>
            <span className="text-text-disabled sm:text-base text-xs truncate">
                {meta.join(" · ")}
            </span>
        </div>
    );
};

export default LibraryDocumentCard;
