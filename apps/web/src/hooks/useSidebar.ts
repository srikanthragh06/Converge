import { useCallback, useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
    currentWorkspaceAtom,
    pinnedDocumentsAtom,
    recentDocumentsAtom,
    refreshSidebarAtom,
    workspacesAtom,
} from "../atoms/sidebar";
import { authAtom } from "../atoms/auth";
import apiClient from "../lib/http";
import useNewDocument from "./useNewDocument";
import type {
    GetLibraryDocumentsResponseDto,
    GetPinnedDocumentsResponseDto,
    GetWorkspacesResponseDto,
    SetDocumentPinnedResponseDto,
} from "@converge/shared";

/**
 * Manages sidebar state: workspace list, selected workspace, and pinned +
 * recent documents for the current workspace. Fetches workspaces on mount,
 * seeds currentWorkspaceAtom from the auth response, provides
 * selectWorkspace, and fetches pinned and recent documents whenever the
 * workspace changes.
 */
const useSidebar = () => {
    const { createDocument, isCreating } = useNewDocument(); // creates a new document in the current workspace
    const [workspaces, setWorkspaces] = useAtom(workspacesAtom); // all workspaces the user belongs to (persisted in atom to survive remounts)
    const [currentWorkspace, setCurrentWorkspace] =
        useAtom(currentWorkspaceAtom); // currently selected workspace from the atom
    const auth = useAtomValue(authAtom); // auth state — used to seed the current workspace on mount
    const [refreshSidebar, setRefreshSidebar] = useAtom(refreshSidebarAtom); // bump to trigger a refetch of workspaces, pinned documents, and recent documents

    const [recentDocuments, setRecentDocuments] = useAtom(recentDocumentsAtom); // most recent, non-pinned documents in the current workspace, shown below the pinned section
    const [pinnedDocuments, setPinnedDocuments] = useAtom(pinnedDocumentsAtom); // documents the user has pinned in the current workspace, shown above recentDocuments

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
     * Fetches the most recent documents in the given workspace for the sidebar
     * list. Passes ignorePinnedDocs so this list never overlaps with
     * pinnedDocuments — the pinned section above it already covers those.
     */
    const fetchRecentDocuments = useCallback(async (workspaceId: number) => {
        try {
            const { data } =
                await apiClient.get<GetLibraryDocumentsResponseDto>(
                    "/document/library",
                    { params: { workspaceId, limit: 12, ignorePinnedDocs: true } },
                );
            setRecentDocuments(data.documents);
        } catch (err) {
            console.error("useSidebar: failed to fetch recent documents", err);
        }
    }, []);

    /** Fetches the user's pinned documents in the given workspace for the sidebar's pinned section. */
    const fetchPinnedDocuments = useCallback(async (workspaceId: number) => {
        try {
            const { data } =
                await apiClient.get<GetPinnedDocumentsResponseDto>(
                    "/document/pinned",
                    { params: { workspaceId } },
                );
            setPinnedDocuments(data.documents);
        } catch (err) {
            console.error("useSidebar: failed to fetch pinned documents", err);
        }
    }, []);

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

    // Fetches pinned and recent documents whenever the current workspace changes,
    // and whenever refreshSidebar is bumped (e.g. by togglePin after a pin/unpin).
    useEffect(() => {
        if (currentWorkspace) {
            fetchPinnedDocuments(currentWorkspace.id);
            fetchRecentDocuments(currentWorkspace.id);
        }
    }, [
        currentWorkspace,
        refreshSidebar,
        fetchPinnedDocuments,
        fetchRecentDocuments,
    ]);

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
