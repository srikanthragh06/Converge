import { useNavigate } from "react-router-dom";
import { MdOutlineDescription } from "react-icons/md";
import { LuInfo, LuTrash2, LuUsers } from "react-icons/lu";
import type { LibraryDocumentDto } from "@converge/shared";
import { timeAgo, formatAccessLevel, hasAccess } from "../../../utils/utils";
import { DropdownMenu, type MenuEntry } from "../../../components/ui/Menu";
import useDocumentMenuActions from "../../../hooks/useDocumentMenuActions";

/**
 * Card block representing a single document in the library grid.
 * Displays a document icon, title, a metadata row with access level and
 * last-visited/edited times, and a Manage Document menu (Share…, Document
 * details, Move to Trash) until the Library table restyle (redesign 9.1).
 */
const LibraryDocumentCard = ({
    document,
}: {
    document: LibraryDocumentDto;
}) => {
    const navigate = useNavigate(); // router navigation for opening the selected document
    const { openShare, openDetails, moveToTrash } = useDocumentMenuActions(); // shared with the sidebar and editor menus
    const menuItems: MenuEntry[] = [
        {
            label: "Share…",
            icon: <LuUsers />,
            onSelect: () => openShare(document),
        },
        {
            label: "Document details",
            icon: <LuInfo />,
            onSelect: () => openDetails(document),
        },
        // Trashing needs admin access; hidden rather than failing with a 403.
        ...(hasAccess(document.access, "admin")
            ? ([
                  { type: "separator" },
                  {
                      label: "Move to Trash",
                      icon: <LuTrash2 />,
                      destructive: true,
                      onSelect: () => moveToTrash(document),
                  },
              ] satisfies MenuEntry[])
            : []),
    ]; // the Manage Document menu
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
            rounded-lg bg-surface cursor-pointer
            hover:opacity-85 active:opacity-70 transition w-11/12 sm:w-[600px] gap-3"
        >
            <MdOutlineDescription className="w-4 h-4 mt-0.5 shrink-0 opacity-40" />
            <div className="flex flex-col space-y-1 min-w-0">
                <span
                    className={`text-fg font-medium sm:text-base text-sm truncate leading-tight ${!document.title && "opacity-20"}`}
                >
                    {document.title || "Untitled"}
                </span>
                <div className="flex flex-col space-y-2">
                    <span className="text-fg opacity-50 text-xs truncate">
                        {meta.join(" · ")}
                    </span>
                    {/* Stops clicks from reaching the card, which opens the document. */}
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu
                            align="start"
                            items={menuItems}
                            className="w-52"
                            trigger={
                                <button className="cursor-pointer rounded-sm text-left text-xs text-fg outline-none transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold/60">
                                    Manage Document
                                </button>
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LibraryDocumentCard;
