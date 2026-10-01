import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/http";
import { workspaceKeys } from "../queries/workspaces";
import type { GetWorkspacesResponseDto } from "@converge/shared";

/**
 * Loads the workspaces the user belongs to from GET /workspaces, cached under
 * `workspaceKeys.list()`. Creating or renaming a workspace refreshes it.
 */
const useWorkspaceList = () => {
    const { data, isPending, refetch } = useQuery({
        queryKey: workspaceKeys.list(),
        queryFn: async () => {
            const { data } =
                await apiClient.get<GetWorkspacesResponseDto>("/workspaces");
            return data.workspaces;
        },
    });

    return {
        workspaces: data ?? [], // the workspace list; empty until the first load finishes
        isLoading: isPending, // true until the first load finishes
        refetch, // reloads the list, e.g. when the workspace dropdown opens
    };
};

export default useWorkspaceList;
