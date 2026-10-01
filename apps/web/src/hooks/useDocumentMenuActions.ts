import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useDocumentId from "./useDocumentId";
import { useSetAtom } from "jotai";
import { documentDialogAtom } from "../atoms/document";
import useMoveToTrash from "./useMoveToTrash";
import useRestoreDocument from "./useRestoreDocument";
import useTogglePin from "./useTogglePin";
import useToast from "./useToast";

/** The parts of a document the menu actions need. */
type MenuDocument = { id: number; title: string };

/**
 * Display name for a document in a toast.
 * @param doc - the document
 */
const displayTitle = (doc: MenuDocument) => doc.title || "Untitled";

/**
 * Actions shared by the document menus (sidebar rows and the editor's ⋯
 * menu): pin or unpin, open in a new tab, copy the link, open the Share /
 * Document details / Version history dialogs, and move to Trash with an
 * Undo toast. Failures are reported with a toast, and actions that
 * change a document's place in the sidebar refresh its lists.
 */
const useDocumentMenuActions = () => {
    const navigate = useNavigate();
    const openDocumentId = useDocumentId(); // document open in the editor, if any
    const setDocumentDialog = useSetAtom(documentDialogAtom); // opens Share / Document details
    const { showToast } = useToast();
    const { togglePin } = useTogglePin();

    /**
     * Opens the document in a new browser tab.
     * @param doc - the document to open
     */
    const openInNewTab = useCallback((doc: MenuDocument) => {
        window.open(`/document/${doc.id}`, "_blank", "noopener");
    }, []);

    /**
     * Copies the document's URL to the clipboard.
     * @param doc - the document to link to
     */
    const copyLink = useCallback(
        async (doc: MenuDocument) => {
            try {
                await navigator.clipboard.writeText(
                    `${window.location.origin}/document/${doc.id}`,
                );
                showToast("Link copied");
            } catch (err) {
                console.error("useDocumentMenuActions: copy failed", err);
                showToast("Couldn't copy the link", { tone: "error" });
            }
        },
        [showToast],
    );

    // The Undo action of the Move to Trash toast.
    const { restoreDocument } = useRestoreDocument({
        onSuccess: (doc) => showToast(`Restored "${displayTitle(doc)}"`),
    });

    // Leaves the editor if the trashed document was open, and offers Undo.
    // No confirmation step, since it's undoable.
    const { moveToTrash } = useMoveToTrash({
        onSuccess: (doc) => {
            if (doc.id === openDocumentId) navigate("/library");
            showToast(`Moved "${displayTitle(doc)}" to Trash`, {
                action: { label: "Undo", onClick: () => restoreDocument(doc) },
            });
        },
    });

    /**
     * Opens the Share dialog for the document.
     * @param doc - the document to share
     */
    const openShare = useCallback(
        (doc: MenuDocument) =>
            setDocumentDialog({
                kind: "share",
                documentId: doc.id,
                title: doc.title,
            }),
        [setDocumentDialog],
    );

    /**
     * Opens the Document details modal for the document.
     * @param doc - the document to describe
     */
    const openDetails = useCallback(
        (doc: MenuDocument) =>
            setDocumentDialog({
                kind: "details",
                documentId: doc.id,
                title: doc.title,
            }),
        [setDocumentDialog],
    );

    /**
     * Opens Version history for the document. It needs the live editor, so
     * this navigates to the document with `openVersionHistory` in the
     * router state, which EditorPageHeader picks up and then clears — also
     * when the document is already open, since navigating to the same
     * route just updates the state.
     * @param doc - the document whose history to show
     */
    const openVersionHistory = useCallback(
        (doc: MenuDocument) =>
            navigate(`/document/${doc.id}`, {
                state: { openVersionHistory: true },
            }),
        [navigate],
    );

    return {
        togglePin,
        openInNewTab,
        copyLink,
        openShare,
        openDetails,
        openVersionHistory,
        moveToTrash,
    };
};

export default useDocumentMenuActions;
