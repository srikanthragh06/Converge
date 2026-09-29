import { useCallback, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
    currentWorkspaceAtom,
    pinnedDocumentsAtom,
    recentDocumentsAtom,
    refreshSidebarAtom,
    workspacesAtom,
} from "../atoms/sidebar";
import { authAtom } from "../atoms/auth";
import apiClient from "../lib/http";
import type {
    GetLibraryDocumentsResponseDto,
    GetPinnedDocumentsResponseDto,
    GetWorkspacesResponseDto,
} from "@converge/shared";

/**
 * Keeps the sidebar atoms fresh: fetches the workspace list on mount, seeds
 * currentWorkspaceAtom from the auth response, and fetches pinned and recent
 * documents whenever the workspace changes or refreshSidebarAtom is bumped.
 * Call it once, from a component that is always mounted with the sidebar —
 * not from the panel itself, which isn't mounted while the phone drawer is
 * closed, yet pages (e.g. Library) still need currentWorkspaceAtom seeded.
 */
const useSidebarSync = () => {
    const setWorkspaces = useSetAtom(workspacesAtom); // all workspaces the user belongs to
    const [currentWorkspace, setCurrentWorkspace] =
        useAtom(currentWorkspaceAtom); // currently selected workspace
    const auth = useAtomValue(authAtom); // auth state — used to seed the current workspace on mount
    const refreshSidebar = useAtomValue(refreshSidebarAtom); // bumped elsewhere to trigger a refetch of workspaces, pinned documents, and recent documents
    const setRecentDocuments = useSetAtom(recentDocumentsAtom); // most recent, non-pinned documents in the current workspace
    const setPinnedDocuments = useSetAtom(pinnedDocumentsAtom); // documents the user has pinned in the current workspace

    /**
     * Fetches the most recent documents in the given workspace for the sidebar
     * list. Passes ignorePinnedDocs so this list never overlaps with
     * pinnedDocuments — the pinned section above it already covers those.
     */
    const fetchRecentDocuments = useCallback(
        async (workspaceId: number) => {
            try {
                const { data } =
                    await apiClient.get<GetLibraryDocumentsResponseDto>(
                        "/document/library",
                        {
                            params: {
                                workspaceId,
                                limit: 12,
                                ignorePinnedDocs: true,
                            },
                        },
                    );
                setRecentDocuments(data.documents);
            } catch (err) {
                console.error(
                    "useSidebarSync: failed to fetch recent documents",
                    err,
                );
            }
        },
        [setRecentDocuments],
    );

    /** Fetches the user's pinned documents in the given workspace for the sidebar's pinned section. */
    const fetchPinnedDocuments = useCallback(
        async (workspaceId: number) => {
            try {
                const { data } =
                    await apiClient.get<GetPinnedDocumentsResponseDto>(
                        "/document/pinned",
                        { params: { workspaceId } },
                    );
                setPinnedDocuments(data.documents);
            } catch (err) {
                console.error(
                    "useSidebarSync: failed to fetch pinned documents",
                    err,
                );
            }
        },
        [setPinnedDocuments],
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
                console.error(
                    "useSidebarSync: failed to fetch workspaces",
                    err,
                );
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
};

export default useSidebarSync;
