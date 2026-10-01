import {
    LuClock,
    LuExternalLink,
    LuInfo,
    LuLink,
    LuPin,
    LuPinOff,
    LuTrash2,
    LuUsers,
} from "react-icons/lu";
import type { LibraryDocumentDto } from "@converge/shared";
import type { MenuEntry } from "../components/ui/Menu";
import { hasAccess } from "../utils/utils";
import useDocumentMenuActions from "./useDocumentMenuActions";

/**
 * The ⋯ / right-click menu of a document row in a list (sidebar Pinned /
 * Recent, Library), pp 8 / 14: Pin, Open in new tab, Copy link, Share…,
 * Document details, Version history, and (admins only) Move to Trash.
 * Version history opens the document first, since it compares against the
 * live editor.
 * @param onDialogOpen - called after Share…, Document details, or Version
 *                       history is chosen, e.g. to close the phone drawer
 * @returns documentMenu(doc, isPinned), which builds a row's entries, and
 *          togglePin, for the row's own pin button
 */
const useDocumentRowMenu = (onDialogOpen?: () => void) => {
    const {
        togglePin,
        openInNewTab,
        copyLink,
        openShare,
        openDetails,
        openVersionHistory,
        moveToTrash,
    } = useDocumentMenuActions();

    /**
     * Builds the menu entries for one row.
     * @param doc - the row's document
     * @param isPinned - whether the user has pinned it to the sidebar
     */
    const documentMenu = (
        doc: LibraryDocumentDto,
        isPinned: boolean,
    ): MenuEntry[] => [
        {
            label: isPinned ? "Unpin from sidebar" : "Pin to sidebar",
            icon: isPinned ? <LuPinOff /> : <LuPin />,
            onSelect: () => togglePin(doc, !isPinned),
        },
        { type: "separator" },
        {
            label: "Open in new tab",
            icon: <LuExternalLink />,
            onSelect: () => openInNewTab(doc),
        },
        {
            label: "Copy link",
            icon: <LuLink />,
            onSelect: () => copyLink(doc),
        },
        { type: "separator" },
        {
            label: "Share…",
            icon: <LuUsers />,
            onSelect: () => {
                openShare(doc);
                onDialogOpen?.();
            },
        },
        {
            label: "Document details",
            icon: <LuInfo />,
            onSelect: () => {
                openDetails(doc);
                onDialogOpen?.();
            },
        },
        {
            label: "Version history",
            icon: <LuClock />,
            onSelect: () => {
                openVersionHistory(doc);
                onDialogOpen?.();
            },
        },
        // Trashing needs admin access; hidden rather than failing with a 403.
        ...(hasAccess(doc.access, "admin")
            ? ([
                  { type: "separator" },
                  {
                      label: "Move to Trash",
                      icon: <LuTrash2 />,
                      destructive: true,
                      onSelect: () => moveToTrash(doc),
                  },
              ] satisfies MenuEntry[])
            : []),
    ];

    return { documentMenu, togglePin };
};

export default useDocumentRowMenu;
