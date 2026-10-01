import { useEffect } from "react";
import {
    keepPreviousData,
    useInfiniteQuery,
    useQuery,
} from "@tanstack/react-query";
import apiClient from "../lib/http";
import { workspaceKeys } from "../queries/workspaces";
import useDebouncedValue from "./useDebouncedValue";
import useInView from "./useInView";
import type {
    GetWorkspaceMembersResponseDto,
    SearchWorkspaceMembersResponseDto,
} from "@converge/shared";

const MEMBERS_LIST_LIMIT = 20;

/**
 * The Members tab's list: every member, a page at a time as the sentinel
 * (`sentinelRef`) scrolls into view, while `email` is empty; otherwise
 * GET /workspaces/:id/members/search results (not paginated), 300ms after
 * the user stops typing.
 * @param workspaceId - the workspace being configured
 * @param email - the email field's text
 * @param enabled - false until the caller's role has loaded
 */
const useWorkspaceMembers = (
    workspaceId: number,
    email: string,
    enabled: boolean,
) => {
    const debouncedEmail = useDebouncedValue(email.trim(), 300);
    // Clearing the field shows the full list at once, without the debounce.
    const query = email.trim() === "" ? "" : debouncedEmail;
    const { ref: sentinelRef, inView } = useInView();

    const list = useInfiniteQuery({
        queryKey: workspaceKeys.members(workspaceId),
        queryFn: async ({ pageParam }) => {
            const { data } =
                await apiClient.get<GetWorkspaceMembersResponseDto>(
                    `/workspaces/${workspaceId}/members`,
                    {
                        params: {
                            limit: MEMBERS_LIST_LIMIT,
                            cursorId: pageParam ?? undefined,
                        },
                    },
                );
            return data;
        },
        initialPageParam: null as number | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled,
    });

    const results = useQuery({
        queryKey: workspaceKeys.memberSearch(workspaceId, query),
        queryFn: async () => {
            const { data } =
                await apiClient.get<SearchWorkspaceMembersResponseDto>(
                    `/workspaces/${workspaceId}/members/search`,
                    { params: { email: query } },
                );
            return data.members;
        },
        enabled: enabled && query !== "",
        // Keep the previous results on screen while the next search loads.
        placeholderData: keepPreviousData,
    });

    const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
    // Loads the next page while the sentinel is on screen; re-runs after each
    // page, so a short page that leaves it visible loads another.
    useEffect(() => {
        if (query === "" && inView && hasNextPage && !isFetchingNextPage)
            fetchNextPage();
    }, [query, inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    if (query === "")
        return {
            members: list.data?.pages.flatMap((page) => page.members) ?? [],
            isLoading: list.isPending,
            isFetchingMore: isFetchingNextPage,
            sentinelRef,
        };
    return {
        members: results.data ?? [],
        isLoading: results.isPending,
        isFetchingMore: false,
        sentinelRef,
    };
};

export default useWorkspaceMembers;
