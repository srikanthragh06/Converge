import { useNavigate } from "react-router-dom";
import type { LibraryDocumentDto } from "@converge/shared";
import { timeAgo, formatAccessLevel } from "../../../utils/utils";

/**
 * Card block representing a single document in the library grid.
 * Displays the document title and a metadata row with access level,
 * last-visited time, and last-edited time.
 */
const LibraryDocumentCard = ({
    document,
}: {
    document: LibraryDocumentDto;
}) => {
    const navigate = useNavigate(); // router navigation for opening the selected document
    const meta = [
        formatAccessLevel(document.access),
        document.lastVisitedAt ? `Last visited ${timeAgo(document.lastVisitedAt)}` : null,
        document.lastEditedAt ? `Edited ${timeAgo(document.lastEditedAt)}` : null,
    ].filter(Boolean);

    return (
        <div
            onClick={() => navigate(`/document/${document.id}`)}
            className="flex flex-col sm:gap-2 gap-1 sm:px-4 sm:py-2 py-2 px-3
        rounded-lg bg-background cursor-pointer
        hover:opacity-80 active:opacity-70 transition w-11/12 sm:w-[600px]"
        >
            <span
                className={`text-white font-medium sm:text-lg text-base truncate ${!document.title && "text-opacity-20"}`}
            >
                {document.title || "Untitled"}
            </span>
            <span className="text-text-disabled sm:text-sm text-xs truncate">
                {meta.join(" · ")}
            </span>
        </div>
    );
};

export default LibraryDocumentCard;
