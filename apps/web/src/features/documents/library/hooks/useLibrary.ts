import { useEffect } from "react";
import {
    keepPreviousData,
    useInfiniteQuery,
    useQuery,
} from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import apiClient from "@/lib/http";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import { documentKeys } from "@/features/documents/queryKeys";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import useInView from "@/hooks/useInView";
import type {
    GetLibraryDocumentsResponseDto,
    SearchLibraryDocumentsResponseDto,
} from "@converge/shared";

const LIBRARY_PAGE_LIMIT = 12;
const LIBRARY_SEARCH_PAGE_LIMIT = 5;

/**
 * The Library page's list: every document in the current workspace, most
 * recently visited first, a page at a time as the sentinel (`sentinelRef`)
 * scrolls into view, while `search` is empty; otherwise GET
 * /document/library/search results (not paginated), 300ms after the user
 * stops typing.
 * @param search - the title filter as typed
 */
const useLibrary = (search: string) => {
    const currentWorkspace = useAtomValue(currentWorkspaceAtom);
    const workspaceId = currentWorkspace?.id ?? 0;
    const debouncedSearch = useDebouncedValue(search.trim(), 300);
    // Clearing the box shows the full list at once, without the debounce.
    const query = search.trim() === "" ? "" : debouncedSearch;
    const { ref: sentinelRef, inView } = useInView();

    const list = useInfiniteQuery({
        queryKey: documentKeys.library(workspaceId),
        queryFn: async ({ pageParam }) => {
            const { data } =
                await apiClient.get<GetLibraryDocumentsResponseDto>(
                    "/document/library",
                    {
                        params: {
                            workspaceId,
                            limit: LIBRARY_PAGE_LIMIT,
                            cursorVisitedAt:
                                pageParam &&
                                new Date(
                                    pageParam.lastVisitedAt!,
                                ).toISOString(),
                            cursorId: pageParam?.id,
                        },
                    },
                );
            return data;
        },
        initialPageParam: null as GetLibraryDocumentsResponseDto["nextCursor"],
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: currentWorkspace !== null,
    });

    const results = useQuery({
        queryKey: documentKeys.librarySearch(workspaceId, query),
        queryFn: async () => {
            const { data } =
                await apiClient.get<SearchLibraryDocumentsResponseDto>(
                    "/document/library/search",
                    {
                        params: {
                            workspaceId,
                            title: query,
                            limit: LIBRARY_SEARCH_PAGE_LIMIT,
                        },
                    },
                );
            return data.documents;
        },
        enabled: currentWorkspace !== null && query !== "",
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
            documents: list.data?.pages.flatMap((page) => page.documents) ?? [],
            isLoading: list.isPending,
            isFetchingMore: isFetchingNextPage,
            sentinelRef,
        };
    return {
        documents: results.data ?? [],
        isLoading: results.isPending,
        isFetchingMore: false,
        sentinelRef,
    };
};

export default useLibrary;
