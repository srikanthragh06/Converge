import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { showToast } from "@/lib/toast";
import { workspaceKeys } from "@/features/workspaces/queryKeys";
import type {
    TransferWorkspaceOwnerResponseDto,
    WorkspaceOverviewResponseDto,
} from "@converge/shared";

/**
 * Transfers a workspace to another user via POST
 * /workspaces/:id/transfer-owner. On success it shows the new owner, refreshes
 * what the transfer changed (the caller's role, the overview's owner, and the
 * role and owner in the workspace lists), shows a toast, and calls onSuccess.
 * A failure shows the global error toast.
 * @param workspaceId - the workspace to transfer
 * @param onSuccess - called after a successful transfer
 */
const useTransferWorkspaceOwner = (
    workspaceId: number,
    { onSuccess }: { onSuccess: () => void },
) => {
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async (newOwnerId: number) => {
            const { data } =
                await apiClient.post<TransferWorkspaceOwnerResponseDto>(
                    `/workspaces/${workspaceId}/transfer-owner`,
                    { newOwnerId },
                );
            return data;
        },
        meta: { errorMessage: "Couldn't transfer ownership" },
        onSuccess: (newOwner) => {
            const workspaceName =
                queryClient.getQueryData<WorkspaceOverviewResponseDto>(
                    workspaceKeys.overview(workspaceId),
                )?.name;
            queryClient.setQueryData(
                workspaceKeys.owner(workspaceId),
                newOwner,
            );
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.myRole(workspaceId),
            });
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.overview(workspaceId),
            });
            queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.searches(),
            });
            showToast(
                `${newOwner.name} now owns ${workspaceName ?? "the workspace"}`,
            );
            onSuccess();
        },
    });

    return {
        transferOwner: (newOwnerId: number) => mutate(newOwnerId), // sends the transfer request
        isTransferring: isPending, // true while the transfer request is in flight
    };
};

export default useTransferWorkspaceOwner;
