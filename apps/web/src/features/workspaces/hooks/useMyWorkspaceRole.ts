import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { workspaceKeys } from "@/features/workspaces/queryKeys";
import type { WorkspaceRole } from "@converge/shared";

/**
 * Loads the current user's role in a workspace from
 * GET /workspaces/:id/my-role, cached under `workspaceKeys.myRole(workspaceId)`.
 * @param workspaceId - the workspace to check
 */
const useMyWorkspaceRole = (workspaceId: number) => {
    const { data } = useQuery({
        queryKey: workspaceKeys.myRole(workspaceId),
        queryFn: async () => {
            const { data } = await apiClient.get<{ role: WorkspaceRole }>(
                `/workspaces/${workspaceId}/my-role`,
            );
            return data.role;
        },
    });

    return {
        role: data ?? null, // the user's role; null until the first load finishes
    };
};

export default useMyWorkspaceRole;
