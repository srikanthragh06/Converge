import { useCallback, useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "../atoms/workspace";
import { authAtom } from "../atoms/auth";
import apiClient from "../lib/http";
import useNewDocument from "./useNewDocument";
import type { GetWorkspacesResponseDto } from "@converge/shared";

/** Shape of a workspace member from GET /workspaces. */
interface WorkspaceMember {
    id: number;
    name: string;
    type: "personal" | "custom";
    role: "owner" | "admin" | "member";
}

/**
 * Manages sidebar workspace state. Fetches the user's workspaces on mount,
 * seeds the current workspace from the auth response, and provides a
 * selectWorkspace function that calls PUT /workspaces/:id/select.
 */
const useSidebar = () => {
    const { createDocument, isCreating } = useNewDocument(); // creates a new document in the current workspace
    const [workspaces, setWorkspaces] = useState<WorkspaceMember[]>([]); // all workspaces the user belongs to
    const [currentWorkspace, setCurrentWorkspace] =
        useAtom(currentWorkspaceAtom); // currently selected workspace from the atom
    const auth = useAtomValue(authAtom); // auth state — used to seed the current workspace on mount

    // Fetches the user's workspace list on mount.
    useEffect(() => {
        const fetchWorkspaces = async () => {
            try {
                const { data } =
                    await apiClient.get<GetWorkspacesResponseDto>(
                        "/workspaces",
                    );
                setWorkspaces(data.workspaces);
            } catch (err) {
                console.error("useSidebar: failed to fetch workspaces", err);
            }
        };
        fetchWorkspaces();
    }, []);

    // Seeds currentWorkspaceAtom from authAtom if not already set.
    useEffect(() => {
        if (
            !currentWorkspace &&
            auth.status === "authenticated" &&
            auth.user?.selectedWorkspace
        ) {
            setCurrentWorkspace(auth.user.selectedWorkspace);
        }
    }, [
        auth.status,
        auth.user?.selectedWorkspace,
        currentWorkspace,
        setCurrentWorkspace,
    ]);

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

    return { workspaces, currentWorkspace, isCreating, selectWorkspace, createDocument };
};

export default useSidebar;
