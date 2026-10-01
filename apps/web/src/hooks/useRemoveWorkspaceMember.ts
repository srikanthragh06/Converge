import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from "@tanstack/react-query";
import apiClient from "../lib/http";
import { workspaceKeys } from "../queries/workspaces";
import type {
    GetWorkspaceMembersResponseDto,
    WorkspaceMemberDto,
} from "@converge/shared";

/**
 * Removes a member from a workspace via DELETE
 * /workspaces/:id/members/:userId. On success it drops them from the cached
 * member list and refreshes the member count and the "add member" lookups.
 * A failure shows the global
 * error toast.
 * @param workspaceId - the workspace being configured
 */
const useRemoveWorkspaceMember = (workspaceId: number) => {
    const queryClient = useQueryClient();

    const { mutate, isPending, variables } = useMutation({
        mutationFn: async (member: WorkspaceMemberDto) => {
            await apiClient.delete(
                `/workspaces/${workspaceId}/members/${member.id}`,
            );
        },
        meta: {
            errorMessage: (member: WorkspaceMemberDto) =>
                `Couldn't remove ${member.name}`,
        },
        onSuccess: (_data, member) => {
            // Drop the row from the cached list and searches rather than
            // refetching, so it disappears as soon as the request succeeds.
            const isKept = (m: WorkspaceMemberDto) => m.id !== member.id;
            queryClient.setQueryData<
                InfiniteData<GetWorkspaceMembersResponseDto>
            >(
                workspaceKeys.members(workspaceId),
                (list) =>
                    list && {
                        ...list,
                        pages: list.pages.map((page) => ({
                            ...page,
                            members: page.members.filter(isKept),
                        })),
                    },
            );
            queryClient.setQueriesData<WorkspaceMemberDto[]>(
                { queryKey: workspaceKeys.memberSearches(workspaceId) },
                (members) => members?.filter(isKept),
            );
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.overview(workspaceId),
            });
            // An old "already a member" lookup for them is now stale.
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.newMemberLookups(workspaceId),
            });
        },
    });

    return {
        removeMember: (member: WorkspaceMemberDto) => mutate(member), // sends the remove request
        removingUserId: isPending ? variables.id : null, // member whose removal is in flight
    };
};

export default useRemoveWorkspaceMember;
