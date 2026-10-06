import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { workspaceKeys } from "@/features/workspaces/queryKeys";
import type {
    GetWorkspaceMembersResponseDto,
    WorkspaceMemberDto,
    WorkspaceRole,
} from "@converge/shared";

/**
 * Changes a member's role (owner only) via POST /workspaces/:id/members. On
 * success it sets the new role in the cached member list and searches, so
 * the role dropdown doesn't flick back while a refetch runs. A failure shows
 * the global error toast.
 * @param workspaceId - the workspace being configured
 */
const useChangeMemberRole = (workspaceId: number) => {
    const queryClient = useQueryClient();

    const { mutate, isPending, variables } = useMutation({
        mutationFn: async ({
            member,
            role,
        }: {
            member: WorkspaceMemberDto;
            role: WorkspaceRole;
        }) => {
            await apiClient.post(`/workspaces/${workspaceId}/members`, {
                email: member.email,
                role,
            });
        },
        meta: {
            errorMessage: ({ member }: { member: WorkspaceMemberDto }) =>
                `Couldn't change ${member.name}'s role`,
        },
        onSuccess: (_data, { member, role }) => {
            const withRole = (m: WorkspaceMemberDto) =>
                m.id === member.id ? { ...m, role } : m;
            queryClient.setQueryData<
                InfiniteData<GetWorkspaceMembersResponseDto>
            >(
                workspaceKeys.members(workspaceId),
                (list) =>
                    list && {
                        ...list,
                        pages: list.pages.map((page) => ({
                            ...page,
                            members: page.members.map(withRole),
                        })),
                    },
            );
            queryClient.setQueriesData<WorkspaceMemberDto[]>(
                { queryKey: workspaceKeys.memberSearches(workspaceId) },
                (members) => members?.map(withRole),
            );
        },
    });

    return {
        changeRole: (member: WorkspaceMemberDto, role: WorkspaceRole) => {
            if (role !== member.role) mutate({ member, role });
        }, // sends the role change, unless the role is unchanged
        changingUserId: isPending ? variables.member.id : null, // member whose role change is in flight
    };
};

export default useChangeMemberRole;
