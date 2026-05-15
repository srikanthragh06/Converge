import { useNavigate } from "react-router-dom";
import { MdOutlineDescription } from "react-icons/md";
import type { LibraryDocumentDto } from "@converge/shared";
import { timeAgo, formatAccessLevel } from "../../../utils/utils";

/**
 * Card block representing a single document in the library grid.
 * Displays a document icon, title, and a metadata row with access level,
 * last-visited time, and last-edited time.
 */
const LibraryDocumentCard = ({
    document,
}: {
    document: LibraryDocumentDto;
}) => {
    const navigate = useNavigate(); // router navigation for opening the selected document
    // Build the metadata string — lastVisitedAt and lastEditedAt are nullable so omit them when absent.
    const meta = [
        formatAccessLevel(document.access),
        document.lastVisitedAt
            ? `Last visited ${timeAgo(document.lastVisitedAt)}`
            : null,
        document.lastEditedAt
            ? `Edited ${timeAgo(document.lastEditedAt)}`
            : null,
    ].filter(Boolean);

    return (
        <div
            onClick={() => navigate(`/document/${document.id}`)}
            className="flex items-start sm:px-4 sm:py-3 py-2 px-3
            rounded-lg bg-background cursor-pointer
            hover:opacity-85 active:opacity-70 transition w-11/12 sm:w-[600px] gap-3"
        >
            <MdOutlineDescription className="w-4 h-4 mt-0.5 shrink-0 opacity-40" />
            <div className="flex flex-col gap-1 min-w-0">
                <span
                    className={`text-white font-medium sm:text-base text-sm truncate ${!document.title && "opacity-20"}`}
                >
                    {document.title || "Untitled"}
                </span>
                <span className="text-text-disabled text-xs truncate">
                    {meta.join(" · ")}
                </span>
            </div>
        </div>
    );
};

export default LibraryDocumentCard;
