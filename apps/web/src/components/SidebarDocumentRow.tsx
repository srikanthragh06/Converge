import { MdDescription, MdPushPin, MdOutlinePushPin } from "react-icons/md";
import type { LibraryDocumentDto } from "@converge/shared";

/**
 * Single row in the sidebar's Pinned or Documents (recent) section: a
 * document title button that navigates to it, plus a pin/unpin toggle.
 */
const SidebarDocumentRow = ({
    doc,
    isPinned,
    onOpen,
    onTogglePin,
}: {
    /** The document this row represents. */
    doc: LibraryDocumentDto;
    /** Whether doc is currently pinned — selects which icon shows and what the toggle click does. */
    isPinned: boolean;
    /** Navigates to the document. */
    onOpen: () => void;
    /** Pins doc if it's currently unpinned, unpins it otherwise. */
    onTogglePin: () => void;
}) => (
    <div className="flex items-center gap-1">
        <button
            onClick={onOpen}
            className="flex-1 min-w-0 flex justify-start items-center gap-2 text-left py-1 px-2 hover:bg-background-hover
        rounded-md transition cursor-pointer text-text-primary"
            aria-label={doc.title}
        >
            <MdDescription
                className={`w-3 h-3 shrink-0 ${!doc.title ? "opacity-40" : ""}`}
            />
            <span
                className={`text-xs sm:text-sm truncate ${!doc.title ? "opacity-40" : ""}`}
            >
                {doc.title || "Untitled"}
            </span>
        </button>
        <button
            onClick={onTogglePin}
            aria-label={isPinned ? "Unpin document" : "Pin document"}
            className="shrink-0 p-1 rounded-md hover:bg-background-hover transition cursor-pointer text-white opacity-40 hover:opacity-100"
        >
            {isPinned ? (
                <MdPushPin className="w-3 h-3" />
            ) : (
                <MdOutlinePushPin className="w-3 h-3" />
            )}
        </button>
    </div>
);

export default SidebarDocumentRow;
