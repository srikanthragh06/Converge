import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
    currentWorkspaceAtom,
    pinnedDocumentsAtom,
    recentDocumentsAtom,
} from "../atoms/sidebar";
import apiClient from "../lib/http";
import useNewDocument from "./useNewDocument";
import useWorkspaceList from "./useWorkspaceList";

/**
 * Sidebar state and actions: the workspace list, selected workspace, pinned +
 * recent documents for the current workspace (the documents kept fresh by
 * useSidebarSync), plus selectWorkspace and document creation. Pin toggling
 * lives in useDocumentMenuActions, shared with the editor's ⋯ menu.
 */
const useSidebar = () => {
    const { createDocument, isCreating } = useNewDocument(); // creates a new document in the current workspace
    const { workspaces, refetch: refetchWorkspaces } = useWorkspaceList(); // all workspaces the user belongs to
    const currentWorkspace = useAtomValue(currentWorkspaceAtom); // currently selected workspace
    const setCurrentWorkspace = useSetAtom(currentWorkspaceAtom); // updated by selectWorkspace
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

    return {
        workspaces,
        currentWorkspace,
        recentDocuments,
        pinnedDocuments,
        isCreating,
        selectWorkspace,
        createDocument,
        refetchWorkspaces,
    };
};

export default useSidebar;
