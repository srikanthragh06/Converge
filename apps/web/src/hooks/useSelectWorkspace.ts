import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { currentWorkspaceAtom } from "../atoms/sidebar";
import apiClient from "../lib/http";
import { workspaceKeys } from "../queries/workspaces";
import type { WorkspaceDto } from "@converge/shared";

/**
 * Switches the user's selected workspace via PUT /workspaces/:id/select and
 * makes it the current workspace. A failure shows the global error toast.
 */
const useSelectWorkspace = () => {
    const queryClient = useQueryClient();
    const setCurrentWorkspace = useSetAtom(currentWorkspaceAtom);

    const { mutate } = useMutation({
        mutationFn: async (id: number) => {
            const { data } = await apiClient.put<{ id: number; name: string }>(
                `/workspaces/${id}/select`,
            );
            return data;
        },
        meta: { errorMessage: "Couldn't switch workspace" },
        onSuccess: (selected) => {
            setCurrentWorkspace(selected);
            // Flip the flag in the cached lists instead of refetching: the
            // server bumps last_visited_at, so a refetch would reorder them.
            const markSelected = (workspaces: WorkspaceDto[] | undefined) =>
                workspaces?.map((w) => ({
                    ...w,
                    isSelected: w.id === selected.id,
                }));
            queryClient.setQueryData(workspaceKeys.list(), markSelected);
            queryClient.setQueriesData(
                { queryKey: workspaceKeys.searches() },
                markSelected,
            );
        },
    });

    return {
        selectWorkspace: (id: number) => mutate(id), // sends the select request
    };
};

export default useSelectWorkspace;
