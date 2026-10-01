import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { workspaceKeys } from "@/features/workspaces/queryKeys";
import type { WorkspaceOverviewResponseDto } from "@converge/shared";

/**
 * Loads a workspace's settings overview (name, type, counts, owner, created
 * date) from GET /workspaces/:id/overview, cached under
 * `workspaceKeys.overview(workspaceId)`.
 * @param workspaceId - the workspace to load
 */
const useWorkspaceOverview = (workspaceId: number) => {
    const { data } = useQuery({
        queryKey: workspaceKeys.overview(workspaceId),
        queryFn: async () => {
            const { data } = await apiClient.get<WorkspaceOverviewResponseDto>(
                `/workspaces/${workspaceId}/overview`,
            );
            return data;
        },
    });

    return {
        overview: data ?? null, // the overview; null until the first load finishes
    };
};

export default useWorkspaceOverview;
