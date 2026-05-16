import { useNavigate } from "react-router-dom";
import { MdOutlineDescription } from "react-icons/md";
import type { LibraryDocumentDto } from "@converge/shared";
import { timeAgo, formatAccessLevel } from "../../../utils/utils";

/**
 * Card block representing a single document in the library grid.
 * Displays a document icon, title, a metadata row with access level and
 * last-visited/edited times, and a Manage Document button.
 */
const LibraryDocumentCard = ({
    document,
    onManage,
}: {
    document: LibraryDocumentDto;
    /** Called with the document ID when the user clicks Manage Document. */
    onManage: (id: number) => void;
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
            <div className="flex flex-col space-y-1 min-w-0">
                <span
                    className={`text-white font-medium sm:text-base text-sm truncate leading-tight ${!document.title && "opacity-20"}`}
                >
                    {document.title || "Untitled"}
                </span>
                <div className="flex flex-col space-y-2">
                    <span className="text-white opacity-50 text-xs truncate">
                        {meta.join(" · ")}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onManage(document.id);
                        }}
                        className="text-xs text-white hover:opacity-80 transition cursor-pointer text-left"
                    >
                        Manage Document
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LibraryDocumentCard;
