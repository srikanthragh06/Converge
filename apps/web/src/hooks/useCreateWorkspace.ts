import { useCallback, useState } from "react";
import { useSetAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { currentWorkspaceAtom } from "../atoms/sidebar";
import apiClient from "../lib/http";
import { workspaceKeys } from "../queries/workspaces";
import type { CreateWorkspaceResponseDto } from "@converge/shared";
import { useNavigate } from "react-router-dom";

/**
 * Returns a createWorkspace function that POST /workspaces with the given
 * name, selects it via PUT /workspaces/:id/select, refreshes the cached
 * workspace list, and navigates to /library.
 */
const useCreateWorkspace = () => {
    const setCurrentWorkspace = useSetAtom(currentWorkspaceAtom);
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

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

                queryClient.invalidateQueries({
                    queryKey: workspaceKeys.list(),
                });

                // Update the selected workspace atom.
                setCurrentWorkspace({ id: data.id, name: data.name });

                navigate("/library");

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
        [setCurrentWorkspace, queryClient],
    );

    return { createWorkspace, isCreating, error };
};

export default useCreateWorkspace;
