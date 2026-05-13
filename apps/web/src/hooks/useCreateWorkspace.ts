import { useCallback, useState } from "react";
import { useSetAtom } from "jotai";
import { currentWorkspaceAtom, workspacesAtom } from "../atoms/sidebar";
import apiClient from "../lib/http";
import type { CreateWorkspaceResponseDto } from "@converge/shared";

/**
 * Returns a createWorkspace function that POST /workspaces with the given
 * name, then PUT /workspaces/:id/select to switch to it, and finally updates
 * the sidebar atoms with the new workspace data.
 */
const useCreateWorkspace = () => {
    const setCurrentWorkspace = useSetAtom(currentWorkspaceAtom);
    const setWorkspaces = useSetAtom(workspacesAtom);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createWorkspace = useCallback(
        async (name: string) => {
            setIsCreating(true);
            setError(null);
            try {
                const { data } =
                    await apiClient.post<CreateWorkspaceResponseDto>(
                        "/workspaces",
                        { name },
                    );
                // Select the newly created workspace on the server so the
                // preference persists across reloads.
                await apiClient.put(`/workspaces/${data.id}/select`);
                // Update client-side atoms to reflect the new workspace.
                setCurrentWorkspace({ id: data.id, name: data.name });
                setWorkspaces((prev) => [
                    ...prev,
                    {
                        id: data.id,
                        name: data.name,
                        type: data.type,
                        role: data.role,
                    },
                ]);
                return true;
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Failed to create workspace";
                setError(message);
                return false;
            } finally {
                setIsCreating(false);
            }
        },
        [setCurrentWorkspace, setWorkspaces],
    );

    return { createWorkspace, isCreating, error };
};

export default useCreateWorkspace;
