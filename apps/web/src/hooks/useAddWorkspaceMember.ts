import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/http";
import { workspaceKeys } from "../queries/workspaces";
import type {
    FindNewWorkspaceUserResponseDto,
    WorkspaceRole,
} from "@converge/shared";

/**
 * Adds a looked-up user to a workspace with the chosen role via POST
 * /workspaces/:id/members. On success it refreshes the member list, the
 * member count, and the "add member" lookups (an old "found" result is now
 * stale), then calls onSuccess. A failure shows the global error toast.
 * @param workspaceId - the workspace to add to
 * @param onSuccess - called after a successful add
 */
const useAddWorkspaceMember = (
    workspaceId: number,
    { onSuccess }: { onSuccess: () => void },
) => {
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async ({
            user,
            role,
        }: {
            user: FindNewWorkspaceUserResponseDto;
            role: WorkspaceRole;
        }) => {
            await apiClient.post(`/workspaces/${workspaceId}/members`, {
                email: user.email,
                role,
            });
        },
        meta: {
            errorMessage: ({
                user,
            }: {
                user: FindNewWorkspaceUserResponseDto;
            }) => `Couldn't add ${user.name}`,
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.members(workspaceId),
            });
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.memberSearches(workspaceId),
            });
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.overview(workspaceId),
            });
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.newMemberLookups(workspaceId),
            });
            onSuccess();
        },
    });

    return {
        addMember: (
            user: FindNewWorkspaceUserResponseDto,
            role: WorkspaceRole,
        ) => mutate({ user, role }), // sends the add request
        isAdding: isPending, // true while the add request is in flight
    };
};

export default useAddWorkspaceMember;
