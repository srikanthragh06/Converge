import { LuInfo, LuLink, LuPin, LuPinOff, LuTrash2 } from "react-icons/lu";
import type { MenuEntry } from "../../../components/ui/Menu";

/**
 * The open document's menu entries: Pin / Unpin, Copy link, Document details,
 * and (admins only) Move to Trash. Shared by the header's ⋯ dropdown and the
 * phone document sheet, which adds its own entries above these.
 * @param isPinned - whether the user has pinned the document to the sidebar
 * @param canTrash - whether the user may move it to Trash (admin access);
 *                   the entry is hidden otherwise rather than failing with a 403
 * @param onTogglePin - pins or unpins the document
 * @param onCopyLink - copies the document's link
 * @param onOpenDetails - opens the document details
 * @param onMoveToTrash - moves the document to Trash
 */
export const getEditorDocumentMenu = ({
    isPinned,
    canTrash,
    onTogglePin,
    onCopyLink,
    onOpenDetails,
    onMoveToTrash,
}: {
    isPinned: boolean;
    canTrash: boolean;
    onTogglePin: () => void;
    onCopyLink: () => void;
    onOpenDetails: () => void;
    onMoveToTrash: () => void;
}): MenuEntry[] => [
    {
        label: isPinned ? "Unpin from sidebar" : "Pin to sidebar",
        icon: isPinned ? <LuPinOff /> : <LuPin />,
        onSelect: onTogglePin,
    },
    { label: "Copy link", icon: <LuLink />, onSelect: onCopyLink },
    { label: "Document details", icon: <LuInfo />, onSelect: onOpenDetails },
    ...(canTrash
        ? ([
              { type: "separator" },
              {
                  label: "Move to Trash",
                  icon: <LuTrash2 />,
                  destructive: true,
                  onSelect: onMoveToTrash,
              },
          ] satisfies MenuEntry[])
        : []),
];
