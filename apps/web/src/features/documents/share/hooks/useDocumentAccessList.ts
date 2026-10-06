import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { accessKeys } from "@/features/documents/share/queryKeys";
import useInView from "@/hooks/useInView";
import type { GetDocumentAccessResponseDto } from "@converge/shared";

/** Page size of the people-with-access list. */
const ACCESS_LIST_LIMIT = 20;

/**
 * The people with direct access to a document, from GET
 * /document-access/:id, a page at a time as the sentinel (`sentinelRef`)
 * scrolls into view.
 * @param documentId - the document being shared
 */
const useDocumentAccessList = (documentId: number) => {
    const { ref: sentinelRef, inView } = useInView();

    const list = useInfiniteQuery({
        queryKey: accessKeys.list(documentId),
        queryFn: async ({ pageParam }) => {
            const { data } = await apiClient.get<GetDocumentAccessResponseDto>(
                `/document-access/${documentId}`,
                {
                    params: {
                        limit: ACCESS_LIST_LIMIT,
                        cursorId: pageParam ?? undefined,
                    },
                },
            );
            return data;
        },
        initialPageParam: null as number | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    });

    const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
    // Loads the next page while the sentinel is on screen; re-runs after each
    // page, so a short page that leaves it visible loads another.
    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    return {
        people: list.data?.pages.flatMap((page) => page.users) ?? [],
        isLoading: list.isPending,
        isFetchingMore: isFetchingNextPage,
        sentinelRef,
    };
};

export default useDocumentAccessList;
