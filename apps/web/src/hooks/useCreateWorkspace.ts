import { useCallback, useState } from "react";
import { useSetAtom } from "jotai";
import { currentWorkspaceAtom, workspacesAtom } from "../atoms/sidebar";
import apiClient from "../lib/http";
import type {
    CreateWorkspaceResponseDto,
    GetWorkspacesResponseDto,
} from "@converge/shared";

/**
 * Returns a createWorkspace function that POST /workspaces with the given
 * name, selects it via PUT /workspaces/:id/select, and refreshes the sidebar
 * workspace list so the atom reflects the enriched server-side data.
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

                // Persist the selection across reloads.
                await apiClient.put(`/workspaces/${data.id}/select`);

                // Refetch the full enriched list from the server.
                const { data: list } =
                    await apiClient.get<GetWorkspacesResponseDto>(
                        "/workspaces",
                    );
                setWorkspaces(list.workspaces);

                // Update the selected workspace atom.
                setCurrentWorkspace({ id: data.id, name: data.name });

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
