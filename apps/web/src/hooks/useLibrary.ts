import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../lib/http";
import type {
    GetLibraryDocumentsResponseDto,
    LibraryDocumentDto,
} from "@converge/shared";

const LIBRARY_PAGE_LIMIT = 12;

/**
 * Manages library page state. Fetches documents from GET /document/library
 * with keyset pagination and wires up an IntersectionObserver on the
 * returned sentinelRef to automatically load the next page on scroll.
 */
const useLibrary = () => {
    const [searchText, setSearchText] = useState(""); // current search query string
    const [documents, setDocuments] = useState<LibraryDocumentDto[]>([]); // accumulated list of fetched documents
    const [isLoadingMore, setIsLoadingMore] = useState(false); // true while a page fetch is in flight

    // Refs used inside loadMore to avoid stale closures without adding them as useCallback deps.
    const nextCursor = useRef<{ lastVisitedAt: Date; id: number } | null>(null); // compound keyset cursor for the next page
    const hasMoreRef = useRef(true); // mirrors hasMore without causing loadMore to be recreated
    const isLoadingRef = useRef(false); // mirrors isLoadingMore without causing loadMore to be recreated

    // Sentinel element stored as state so the observer effect re-runs when it mounts.
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
    // Callback ref passed to the sentinel div — React calls this when the element mounts.
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => setSentinelEl(node),
        [],
    );

    // Fetches the first page of the user's library on mount.
    useEffect(() => {
        const fetchLibrary = async () => {
            const { data } =
                await apiClient.get<GetLibraryDocumentsResponseDto>(
                    "/document/library",
                    { params: { limit: LIBRARY_PAGE_LIMIT } },
                );
            setDocuments(data.documents);
            nextCursor.current = data.nextCursor
                ? {
                      id: data.nextCursor.id,
                      lastVisitedAt: new Date(data.nextCursor.lastVisitedAt),
                  }
                : null;
            hasMoreRef.current = data.nextCursor !== null;
        };

        fetchLibrary();
    }, []);

    /**
     * Fetches the next page of documents and appends them to the list.
     * No-ops if a fetch is already in flight or there are no more pages.
     * Uses refs for guards so this function stays stable across renders.
     */
    const loadMore = useCallback(async () => {
        if (isLoadingRef.current || !hasMoreRef.current || !nextCursor.current)
            return;

        isLoadingRef.current = true;
        setIsLoadingMore(true);

        try {
            const { data } = await apiClient.get<GetLibraryDocumentsResponseDto>(
                "/document/library",
                {
                    params: {
                        limit: LIBRARY_PAGE_LIMIT,
                        cursorVisitedAt:
                            nextCursor.current.lastVisitedAt.toISOString(),
                        cursorId: nextCursor.current.id,
                    },
                },
            );

            setDocuments((prev) => [...prev, ...data.documents]);
            nextCursor.current = data.nextCursor
                ? {
                      id: data.nextCursor.id,
                      lastVisitedAt: new Date(data.nextCursor.lastVisitedAt),
                  }
                : null;
            hasMoreRef.current = data.nextCursor !== null;
        } finally {
            isLoadingRef.current = false;
            setIsLoadingMore(false);
        }
    }, []);

    // Observes the sentinel element and calls loadMore when it enters the viewport.
    // Depends on sentinelEl so it re-runs once the element actually mounts.
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

    return { searchText, setSearchText, documents, isLoadingMore, sentinelRef };
};

export default useLibrary;
