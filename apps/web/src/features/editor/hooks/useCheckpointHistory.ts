import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { checkpointKeys } from "@/features/editor/queryKeys";
import useInView from "@/hooks/useInView";
import type {
    DocumentCheckpointDto,
    GetDocumentCheckpointsResponseDto,
} from "@converge/shared";

/** Page size of the checkpoint list. */
const CHECKPOINTS_LIST_LIMIT = 10;

/**
 * A document's version-history checkpoints, newest first, a page at a time
 * as the sentinel (`sentinelRef`) scrolls into view, plus which one is
 * selected — the newest until the user picks another.
 * @param documentId - the document whose checkpoints to list
 */
const useCheckpointHistory = (documentId: number) => {
    const [pickedId, setPickedId] = useState<number | null>(null); // checkpoint the user selected; null means the newest
    const { ref: sentinelRef, inView } = useInView();

    const list = useInfiniteQuery({
        queryKey: checkpointKeys.list(documentId),
        queryFn: async ({ pageParam }) => {
            const { data } =
                await apiClient.get<GetDocumentCheckpointsResponseDto>(
                    `/document/${documentId}/checkpoints`,
                    {
                        params: {
                            limit: CHECKPOINTS_LIST_LIMIT,
                            cursorId: pageParam ?? undefined,
                        },
                    },
                );
            return data;
        },
        initialPageParam: null as number | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        // The server adds checkpoints on its own (scheduler, MCP edits), so
        // re-fetch on every open rather than trusting a recent cache.
        staleTime: 0,
    });

    const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
    // Loads the next page while the sentinel is on screen; re-runs after each
    // page, so a short page that leaves it visible loads another.
    useEffect(() => {
        if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const checkpoints =
        list.data?.pages.flatMap((page) => page.checkpoints) ?? [];

    return {
        checkpoints,
        isLoading: list.isPending,
        isFetchingMore: isFetchingNextPage,
        sentinelRef,
        selectedCheckpoint:
            checkpoints.find((c) => c.id === pickedId) ??
            checkpoints[0] ??
            null,
        // Selects a checkpoint; null goes back to the newest.
        setSelectedCheckpoint: (checkpoint: DocumentCheckpointDto | null) =>
            setPickedId(checkpoint?.id ?? null),
    };
};

export default useCheckpointHistory;
