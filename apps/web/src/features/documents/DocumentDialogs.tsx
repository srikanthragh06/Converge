import { useAtom } from "jotai";
import { documentDialogAtom } from "@/atoms/document";
import ShareDialog from "./share/ShareDialog";
import DocumentDetailsModal from "./details/DocumentDetailsModal";

/**
 * Renders the Share dialog or Document details modal named by
 * documentDialogAtom, for whichever document it points at. Mounted once in
 * AppShell, so the editor header and the sidebar row menus open the same
 * dialogs from any page.
 */
const DocumentDialogs = () => {
    const [dialog, setDialog] = useAtom(documentDialogAtom); // the open dialog and its document, or null

    if (!dialog) return null;
    const { documentId } = dialog;
    const close = () => setDialog(null);

    return dialog.kind === "share" ? (
        <ShareDialog
            // Remount per document, so switching targets never shows stale state.
            key={documentId}
            documentId={documentId}
            title={dialog.title}
            onClose={close}
        />
    ) : (
        <DocumentDetailsModal
            key={documentId}
            documentId={documentId}
            onClose={close}
        />
    );
};

export default DocumentDialogs;
