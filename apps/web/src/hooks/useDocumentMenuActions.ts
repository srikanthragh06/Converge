import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { pinOverridesAtom } from "../atoms/sidebar";
import { documentDialogAtom } from "../atoms/document";
import apiClient from "../lib/http";
import { documentKeys } from "../queries/documents";
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
 * menu): pin or unpin, open in a new tab, copy the link, open the Share /
 * Document details / Version history dialogs, and move to Trash with an
 * Undo toast. Failures are reported with a toast, and actions that
 * change a document's place in the sidebar refresh its lists.
 */
const useDocumentMenuActions = () => {
    const navigate = useNavigate();
    const { documentId: openDocumentId } = useParams(); // document open in the editor, if any
    const setPinOverrides = useSetAtom(pinOverridesAtom); // records each toggle, so the editor's ⋯ menu follows it
    const setDocumentDialog = useSetAtom(documentDialogAtom); // opens Share / Document details
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    /**
     * Pins or unpins the document via PUT /document/:id/pin, then refreshes
     * the document lists, including both pinned and recent — the
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
                queryClient.invalidateQueries({
                    queryKey: documentKeys.lists(),
                });
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
        [queryClient, setPinOverrides, showToast],
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
                queryClient.invalidateQueries({
                    queryKey: documentKeys.lists(),
                });
                showToast(`Restored "${displayTitle(doc)}"`);
            } catch (err) {
                console.error("useDocumentMenuActions: restore failed", err);
                showToast("Couldn't restore the document", { tone: "error" });
            }
        },
        [queryClient, showToast],
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
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
            if (String(doc.id) === openDocumentId) navigate("/library");
            showToast(`Moved "${displayTitle(doc)}" to Trash`, {
                action: { label: "Undo", onClick: () => restore(doc) },
            });
        },
        [navigate, openDocumentId, queryClient, restore, showToast],
    );

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
