import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
    currentWorkspaceAtom,
    pinnedDocumentsAtom,
    recentDocumentsAtom,
    workspacesAtom,
} from "../atoms/sidebar";
import apiClient from "../lib/http";
import useNewDocument from "./useNewDocument";
import type { GetWorkspacesResponseDto } from "@converge/shared";

/**
 * Sidebar state and actions: the workspace list, selected workspace, pinned +
 * recent documents for the current workspace (all kept fresh by
 * useSidebarSync), plus selectWorkspace and document creation. Pin toggling
 * lives in useDocumentMenuActions, shared with the editor's ⋯ menu.
 */
const useSidebar = () => {
    const { createDocument, isCreating } = useNewDocument(); // creates a new document in the current workspace
    const workspaces = useAtomValue(workspacesAtom); // all workspaces the user belongs to
    const setWorkspaces = useSetAtom(workspacesAtom); // replaced by refetchWorkspaces
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
