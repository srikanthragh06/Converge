import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import apiClient from "@/lib/http";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import { documentKeys } from "@/features/documents/queryKeys";
import useInView from "@/hooks/useInView";
import type { GetTrashDocumentsResponseDto } from "@converge/shared";

const TRASH_PAGE_LIMIT = 12;

/**
 * The Trash page's list: the current workspace's deleted documents, newest
 * first, a page at a time as the sentinel (`sentinelRef`) scrolls into view.
 * @param filterText - filters the list by title. The server has no trash
 * search, so this filters on the client — and while a filter is set, the
 * remaining pages are loaded one after another so no match is missed.
 */
const useTrash = (filterText: string) => {
    const currentWorkspace = useAtomValue(currentWorkspaceAtom);
    const workspaceId = currentWorkspace?.id ?? 0;
    const { ref: sentinelRef, inView } = useInView();

    const list = useInfiniteQuery({
        queryKey: documentKeys.trash(workspaceId),
        queryFn: async ({ pageParam }) => {
            const { data } = await apiClient.get<GetTrashDocumentsResponseDto>(
                "/document/trash",
                {
                    params: {
                        workspaceId,
                        limit: TRASH_PAGE_LIMIT,
                        cursorDeletedAt:
                            pageParam &&
                            new Date(pageParam.deletedAt).toISOString(),
                        cursorId: pageParam?.id,
                    },
                },
            );
            return data;
        },
        initialPageParam: null as GetTrashDocumentsResponseDto["nextCursor"],
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: currentWorkspace !== null,
    });

    const query = filterText.trim().toLowerCase(); // normalized filter; empty means no filter

    const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
    // Loads the next page while the sentinel is on screen, or while a filter
    // is set (so it sees the whole trash); re-runs after each page.
    useEffect(() => {
        if ((query || inView) && hasNextPage && !isFetchingNextPage)
            fetchNextPage();
    }, [query, inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const documents = list.data?.pages.flatMap((page) => page.documents) ?? [];

    return {
        documents: query
            ? documents.filter((d) =>
                  (d.title || "Untitled").toLowerCase().includes(query),
              )
            : documents,
        isLoading: list.isPending,
        isFetchingMore: isFetchingNextPage,
        sentinelRef,
    };
};

export default useTrash;
