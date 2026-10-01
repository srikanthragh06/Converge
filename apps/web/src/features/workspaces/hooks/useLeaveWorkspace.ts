import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { showToast } from "@/lib/toast";
import { workspaceKeys } from "@/features/workspaces/queryKeys";
import type { WorkspaceOverviewResponseDto } from "@converge/shared";

/**
 * Leaves a workspace via POST /workspaces/:id/leave-workspace. On success it
 * refreshes the workspace lists, shows a toast, and calls onSuccess. A
 * failure shows the global error toast.
 * @param workspaceId - the workspace to leave
 * @param onSuccess - called after a successful leave
 */
const useLeaveWorkspace = (
    workspaceId: number,
    { onSuccess }: { onSuccess: () => void },
) => {
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            await apiClient.post(`/workspaces/${workspaceId}/leave-workspace`);
        },
        meta: { errorMessage: "Couldn't leave the workspace" },
        onSuccess: () => {
            const name = queryClient.getQueryData<WorkspaceOverviewResponseDto>(
                workspaceKeys.overview(workspaceId),
            )?.name;
            queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.searches(),
            });
            showToast(`Left "${name ?? "the workspace"}"`);
            onSuccess();
        },
    });

    return {
        leaveWorkspace: () => mutate(), // sends the leave request
        isLeaving: isPending, // true while the leave request is in flight
    };
};

export default useLeaveWorkspace;
