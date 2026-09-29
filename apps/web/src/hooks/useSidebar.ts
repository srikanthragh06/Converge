import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
    currentWorkspaceAtom,
    pinnedDocumentsAtom,
    recentDocumentsAtom,
    refreshSidebarAtom,
    workspacesAtom,
} from "../atoms/sidebar";
import apiClient from "../lib/http";
import useNewDocument from "./useNewDocument";
import type {
    GetWorkspacesResponseDto,
    SetDocumentPinnedResponseDto,
} from "@converge/shared";

/**
 * Sidebar state and actions: the workspace list, selected workspace, pinned +
 * recent documents for the current workspace (all kept fresh by
 * useSidebarSync), plus selectWorkspace, document creation, and pin toggling.
 */
const useSidebar = () => {
    const { createDocument, isCreating } = useNewDocument(); // creates a new document in the current workspace
    const workspaces = useAtomValue(workspacesAtom); // all workspaces the user belongs to
    const setWorkspaces = useSetAtom(workspacesAtom); // replaced by refetchWorkspaces
    const currentWorkspace = useAtomValue(currentWorkspaceAtom); // currently selected workspace
    const setCurrentWorkspace = useSetAtom(currentWorkspaceAtom); // updated by selectWorkspace
    const setRefreshSidebar = useSetAtom(refreshSidebarAtom); // bump to trigger a refetch of workspaces, pinned documents, and recent documents
    const recentDocuments = useAtomValue(recentDocumentsAtom); // most recent, non-pinned documents in the current workspace, shown below the pinned section
    const pinnedDocuments = useAtomValue(pinnedDocumentsAtom); // documents the user has pinned in the current workspace, shown above recentDocuments

    /**
     * Switches the user's selected workspace via PUT /workspaces/:id/select
     * and updates the atom on success.
     */
    const selectWorkspace = useCallback(
        async (id: number) => {
            try {
                const { data } = await apiClient.put<{
                    id: number;
                    name: string;
                }>(`/workspaces/${id}/select`);
                setCurrentWorkspace(data);
            } catch (err) {
                console.error("useSidebar: failed to select workspace", err);
            }
        },
        [setCurrentWorkspace],
    );

    /** Re-fetches the workspace list from the server (e.g. when the user opens the dropdown). */
    const refetchWorkspaces = useCallback(async () => {
        try {
            const { data } =
                await apiClient.get<GetWorkspacesResponseDto>("/workspaces");
            setWorkspaces(data.workspaces);
        } catch (err) {
            console.error("useSidebar: failed to refetch workspaces", err);
        }
    }, [setWorkspaces]);

    /**
     * Pins or unpins the given document via PUT /document/:id/pin, then bumps
     * refreshSidebarAtom to re-fetch both pinnedDocuments and recentDocuments
     * from the server — the two lists are complements of each other
     * (ignorePinnedDocs), so a toggle in either direction needs both
     * re-fetched to move the document across without duplicating or losing it.
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
                setRefreshSidebar((prev) => prev + 1);
            } catch (err) {
                console.error("useSidebar: failed to toggle pin", err);
            }
        },
        [setRefreshSidebar],
    );

    return {
        workspaces,
        currentWorkspace,
        recentDocuments,
        pinnedDocuments,
        isCreating,
        selectWorkspace,
        createDocument,
        refetchWorkspaces,
        togglePin,
    };
};

export default useSidebar;
