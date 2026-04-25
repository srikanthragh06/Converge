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
    const [isLoadingMore, setIsLoadingMore] = useState(false); // true when api is loading

    const nextCursor = useRef<{ lastVisitedAt: Date; id: number } | null>(null); // compound keyset cursor for the next page
    const hasMoreRef = useRef(true); // whether another page exists — ref so loadMore always reads the latest value without needing to be in its deps

    // Sentinel element stored as state so the observer effect re-runs when it mounts.
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
    // Callback ref passed to the sentinel div — React calls this when the element mounts.
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => setSentinelEl(node),
        [],
    );

    /**
     * Fetches the next page of documents and appends them to the list.
     * No-ops if a fetch is already in flight or there are no more pages.
     */
    const loadMore = async () => {
        if (isLoadingMore || !hasMoreRef.current) return;

        try {
            setIsLoadingMore(true);
            const { data } =
                await apiClient.get<GetLibraryDocumentsResponseDto>(
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
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    // Fetches the first page of the user's library on mount.
    useEffect(() => {
        const fetchLibrary = async () => {
            try {
                setIsLoadingMore(true);
                const { data } =
                    await apiClient.get<GetLibraryDocumentsResponseDto>(
                        "/document/library",
                        { params: { limit: LIBRARY_PAGE_LIMIT } },
                    );
                setDocuments(data.documents);
                nextCursor.current = data.nextCursor
                    ? {
                          id: data.nextCursor.id,
                          lastVisitedAt: new Date(
                              data.nextCursor.lastVisitedAt,
                          ),
                      }
                    : null;
                hasMoreRef.current = data.nextCursor !== null;
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoadingMore(false);
            }
        };

        fetchLibrary();
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
