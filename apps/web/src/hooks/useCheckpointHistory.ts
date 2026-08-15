import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../lib/http";
import type {
    DocumentCheckpointDto,
    GetDocumentCheckpointsResponseDto,
} from "@converge/shared";

/** Page size for both the initial fetch and each subsequent loadMore call. */
const CHECKPOINTS_LIST_LIMIT = 10;

/**
 * Fetches a document's version-history checkpoints with infinite-scroll
 * keyset pagination, newest first. Fetches the first page whenever
 * documentId changes, resetting any accumulated state from a prior document.
 * @param documentId - the document whose checkpoints to fetch
 */
const useCheckpointHistory = (documentId: string | undefined) => {
    const [checkpoints, setCheckpoints] = useState<DocumentCheckpointDto[]>([]); // accumulated checkpoint list, newest first; replaced on documentId change, appended on loadMore
    const [isLoading, setIsLoading] = useState(false); // true while the first page fetch is in flight
    const [isFetchingMore, setIsFetchingMore] = useState(false); // true while a subsequent page fetch is in flight

    const nextCursorRef = useRef<number | null>(null); // keyset cursor for the next page; null when no more pages exist
    const hasMoreRef = useRef(true); // whether another page exists — ref so loadMore reads the latest value without being in its own deps

    // Sentinel element stored as state so the observer effect re-runs when it mounts.
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
    // Callback ref passed to the sentinel div — React calls this when the element mounts or unmounts.
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => setSentinelEl(node),
        [],
    );

    /**
     * Fetches the next page and appends it to checkpoints. No-ops when a
     * fetch is already in flight, there are no more pages, or documentId is
     * not yet available.
     */
    const loadMore = useCallback(async () => {
        if (!documentId || isFetchingMore || !hasMoreRef.current) return;
        try {
            setIsFetchingMore(true);
            const { data } =
                await apiClient.get<GetDocumentCheckpointsResponseDto>(
                    `/document/${documentId}/checkpoints`,
                    {
                        params: {
                            limit: CHECKPOINTS_LIST_LIMIT,
                            cursorId: nextCursorRef.current ?? undefined,
                        },
                    },
                );
            setCheckpoints((prev) => [...prev, ...data.checkpoints]);
            nextCursorRef.current = data.nextCursor;
            hasMoreRef.current = data.nextCursor !== null;
        } catch (err) {
            console.error(
                "useCheckpointHistory: failed to load more checkpoints:",
                err,
            );
        } finally {
            setIsFetchingMore(false);
        }
    }, [documentId, isFetchingMore]);

    // Fetches the first page whenever documentId changes, resetting pagination state.
    useEffect(() => {
        if (!documentId) return;

        const fetchFirstPage = async () => {
            try {
                setIsLoading(true);
                const { data } =
                    await apiClient.get<GetDocumentCheckpointsResponseDto>(
                        `/document/${documentId}/checkpoints`,
                        { params: { limit: CHECKPOINTS_LIST_LIMIT } },
                    );
                setCheckpoints(data.checkpoints);
                nextCursorRef.current = data.nextCursor;
                hasMoreRef.current = data.nextCursor !== null;
            } catch (err) {
                console.error(
                    "useCheckpointHistory: failed to fetch checkpoints:",
                    err,
                );
            } finally {
                setIsLoading(false);
            }
        };

        fetchFirstPage();
    }, [documentId]);

    // Observes the sentinel element and calls loadMore when it enters the viewport.
    // Depends on sentinelEl so it re-runs once the sentinel actually mounts.
    useEffect(() => {
        if (!sentinelEl) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) loadMore();
            },
            { threshold: 0.1 },
        );

        observer.observe(sentinelEl);
        return () => observer.disconnect();
    }, [sentinelEl, loadMore]);

    return { checkpoints, isLoading, isFetchingMore, sentinelRef };
};

export default useCheckpointHistory;
