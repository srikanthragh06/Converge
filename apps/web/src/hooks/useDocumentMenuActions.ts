import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSetAtom } from "jotai";
import { pinOverridesAtom, refreshSidebarAtom } from "../atoms/sidebar";
import apiClient from "../lib/http";
import useToast from "./useToast";
import type { SetDocumentPinnedResponseDto } from "@converge/shared";

/** The parts of a document the menu actions need. */
type MenuDocument = { id: number; title: string };

/**
 * Display name for a document in a toast.
 * @param doc - the document
 */
const displayTitle = (doc: MenuDocument) => doc.title || "Untitled";

/**
 * Actions shared by the document menus (sidebar rows and the editor's ⋯
 * menu): pin or unpin, open in a new tab, copy the link, and move to Trash
 * with an Undo toast. Failures are reported with a toast, and actions that
 * change a document's place in the sidebar refresh its lists.
 */
const useDocumentMenuActions = () => {
    const navigate = useNavigate();
    const { documentId: openDocumentId } = useParams(); // document open in the editor, if any
    const setRefreshSidebar = useSetAtom(refreshSidebarAtom); // bumped so Pinned / Recent drop or regain a document
    const setPinOverrides = useSetAtom(pinOverridesAtom); // records each toggle, so the editor's ⋯ menu follows it
    const { showToast } = useToast();

    /**
     * Pins or unpins the document via PUT /document/:id/pin, then bumps
     * refreshSidebarAtom to re-fetch both the pinned and recent lists — the
     * two are complements of each other (ignorePinnedDocs), so a toggle in
     * either direction needs both re-fetched to move the document across
     * without duplicating or losing it.
     * @param documentId - the document being pinned or unpinned
     * @param pinned - true to pin, false to unpin
     */
    const togglePin = useCallback(
        async (documentId: number, pinned: boolean) => {
            try {
                await apiClient.put<SetDocumentPinnedResponseDto>(
                    `/document/${documentId}/pin`,
                    { pinned },
                );
                setPinOverrides((prev) => ({ ...prev, [documentId]: pinned }));
                setRefreshSidebar((prev) => prev + 1);
            } catch (err) {
                console.error("useDocumentMenuActions: pin failed", err);
                showToast(
                    pinned
                        ? "Couldn't pin the document"
                        : "Couldn't unpin the document",
                    { tone: "error" },
                );
            }
        },
        [setPinOverrides, setRefreshSidebar, showToast],
    );

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

    /**
     * Restores a document from Trash via POST /document/:id/restore — the
     * Undo action of the Move to Trash toast.
     * @param doc - the trashed document
     */
    const restore = useCallback(
        async (doc: MenuDocument) => {
            try {
                await apiClient.post(`/document/${doc.id}/restore`);
                setRefreshSidebar((prev) => prev + 1);
                showToast(`Restored "${displayTitle(doc)}"`);
            } catch (err) {
                console.error("useDocumentMenuActions: restore failed", err);
                showToast("Couldn't restore the document", { tone: "error" });
            }
        },
        [setRefreshSidebar, showToast],
    );

    /**
     * Soft-deletes the document via DELETE /document/:id (admin access
     * required), leaving the editor if it was the open document, and shows a
     * toast whose Undo restores it. No confirmation step, since it's undoable.
     * @param doc - the document to trash
     */
    const moveToTrash = useCallback(
        async (doc: MenuDocument) => {
            try {
                await apiClient.delete(`/document/${doc.id}`);
            } catch (err) {
                console.error("useDocumentMenuActions: delete failed", err);
                showToast("Couldn't move the document to Trash", {
                    tone: "error",
                });
                return;
            }
            setRefreshSidebar((prev) => prev + 1);
            if (String(doc.id) === openDocumentId) navigate("/library");
            showToast(`Moved "${displayTitle(doc)}" to Trash`, {
                action: { label: "Undo", onClick: () => restore(doc) },
            });
        },
        [navigate, openDocumentId, restore, setRefreshSidebar, showToast],
    );

    return { togglePin, openInNewTab, copyLink, moveToTrash };
};

export default useDocumentMenuActions;
