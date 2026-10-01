import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/http";
import { workspaceKeys } from "../queries/workspaces";
import type { GetWorkspaceOwnerResponseDto } from "@converge/shared";

/**
 * Loads a workspace's current owner from GET /workspaces/:id/owner, cached
 * under `workspaceKeys.owner(workspaceId)`. A transfer updates it.
 * @param workspaceId - the workspace to load
 */
const useWorkspaceOwner = (workspaceId: number) => {
    const { data } = useQuery({
        queryKey: workspaceKeys.owner(workspaceId),
        queryFn: async () => {
            const { data } = await apiClient.get<GetWorkspaceOwnerResponseDto>(
                `/workspaces/${workspaceId}/owner`,
            );
            return data;
        },
    });

    return {
        owner: data ?? null, // the owner; null until the first load finishes
    };
};

export default useWorkspaceOwner;
