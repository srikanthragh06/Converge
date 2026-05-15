import { useCallback, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
    currentWorkspaceAtom,
    recentDocumentsAtom,
    refreshSidebarAtom,
    workspacesAtom,
} from "../atoms/sidebar";
import { authAtom } from "../atoms/auth";
import apiClient from "../lib/http";
import useNewDocument from "./useNewDocument";
import type {
    GetLibraryDocumentsResponseDto,
    GetWorkspacesResponseDto,
} from "@converge/shared";

/**
 * Manages sidebar state: workspace list, selected workspace, and recent
 * documents for the current workspace. Fetches workspaces on mount, seeds
 * currentWorkspaceAtom from the auth response, provides selectWorkspace,
 * and fetches recent documents whenever the workspace changes.
 */
const useSidebar = () => {
    const { createDocument, isCreating } = useNewDocument(); // creates a new document in the current workspace
    const [workspaces, setWorkspaces] = useAtom(workspacesAtom); // all workspaces the user belongs to (persisted in atom to survive remounts)
    const [currentWorkspace, setCurrentWorkspace] =
        useAtom(currentWorkspaceAtom); // currently selected workspace from the atom
    const auth = useAtomValue(authAtom); // auth state — used to seed the current workspace on mount
    const refreshSidebar = useAtomValue(refreshSidebarAtom); // incremented externally to trigger a refetch

    const [recentDocuments, setRecentDocuments] = useAtom(recentDocumentsAtom); // most recent documents in the current workspace, shown in the sidebar

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

    /** Fetches the most recent documents in the given workspace for the sidebar list. */
    const fetchRecentDocuments = useCallback(async (workspaceId: number) => {
        try {
            const { data } =
                await apiClient.get<GetLibraryDocumentsResponseDto>(
                    "/document/library",
                    { params: { workspaceId, limit: 12 } },
                );
            setRecentDocuments(data.documents);
        } catch (err) {
            console.error("useSidebar: failed to fetch recent documents", err);
        }
    }, []);

    // Fetches the user's workspace list on mount and whenever refreshSidebar is
    // incremented externally (e.g. after workspace create/rename).
    useEffect(() => {
        const fetchWorkspaces = async () => {
            try {
                const { data } =
                    await apiClient.get<GetWorkspacesResponseDto>(
                        "/workspaces",
                    );
                setWorkspaces(data.workspaces);

                // Sync the selected workspace name if it changed on the server (e.g. after rename via GeneralTab).
                if (currentWorkspace) {
                    const updated = data.workspaces.find(
                        (w) => w.id === currentWorkspace.id,
                    );
                    if (updated)
                        setCurrentWorkspace({
                            id: updated.id,
                            name: updated.name,
                        });
                }
            } catch (err) {
                console.error("useSidebar: failed to fetch workspaces", err);
            }
        };
        fetchWorkspaces();
    }, [refreshSidebar, setWorkspaces, setCurrentWorkspace]);

    // Seeds currentWorkspaceAtom from authAtom if not already set.
    useEffect(() => {
        if (
            !currentWorkspace &&
            auth.status === "authenticated" &&
            auth.user?.selectedWorkspace
        ) {
            setCurrentWorkspace(auth.user.selectedWorkspace);
        }
    }, [auth.status, auth.user?.selectedWorkspace, setCurrentWorkspace]);

    // Fetches recent documents whenever the current workspace changes.
    useEffect(() => {
        if (currentWorkspace) fetchRecentDocuments(currentWorkspace.id);
    }, [currentWorkspace, fetchRecentDocuments]);

    return {
        workspaces,
        currentWorkspace,
        recentDocuments,
        isCreating,
        selectWorkspace,
        createDocument,
        refetchWorkspaces,
    };
};

export default useSidebar;
