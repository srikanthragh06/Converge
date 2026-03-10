// Shared hook for fetching and searching the current user's document library.
// When query is empty, fetches GET /getUserViewedDocs (recency order, paginated).
// When query is non-empty, fetches GET /searchUserDocs?q=... (trigram similarity, not paginated).
// Debounces the API call to avoid hammering the server on keystrokes.
// loadMore appends the next page using the compound cursor (lastViewedAt, lastId).
// Used by both LibraryPage and DocSearchOverlay so they share the same logic.

import { useState, useEffect, useRef } from "react";
import { axiosClient } from "../lib/axiosClient";
import { ApiResponse, DocumentLibraryData, DocumentLibraryItem, DocumentSearchData } from "../types/api";

const useDocumentSearch = () => {
    // Debounce window before the search fires after the user stops typing.
    const SEARCH_DEBOUNCE_MS = 300;

    const [query, setQuery] = useState("");
    const [documents, setDocuments] = useState<DocumentLibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    // Compound cursor for the next page; null means no more pages (or search mode).
    const [nextCursor, setNextCursor] = useState<{ lastId: number; lastViewedAt: string } | null>(null);
    // Track the latest fetch request so stale responses are discarded.
    const latestRequestId = useRef(0);

    // Reset and fetch the first page whenever the query changes.
    useEffect(() => {
        const requestId = ++latestRequestId.current;

        const fetchDocs = async () => {
            setIsLoading(true);
            setDocuments([]);
            setNextCursor(null);
            try {
                const trimmed = query.trim();
                if (trimmed.length > 0) {
                    const res = await axiosClient.get<ApiResponse<DocumentSearchData>>(
                        `/searchUserDocs?q=${encodeURIComponent(trimmed)}`,
                    );
                    if (requestId !== latestRequestId.current) return;
                    if (res.data.success) setDocuments(res.data.data.documents);
                } else {
                    const res = await axiosClient.get<ApiResponse<DocumentLibraryData>>("/getUserViewedDocs");
                    if (requestId !== latestRequestId.current) return;
                    if (res.data.success) {
                        setDocuments(res.data.data.documents);
                        setNextCursor(res.data.data.nextCursor);
                    }
                }
            } catch (err) {
                if (requestId !== latestRequestId.current) return;
                console.error("useDocumentSearch fetch failed:", err);
            } finally {
                if (requestId === latestRequestId.current) setIsLoading(false);
            }
        };

        const timer = setTimeout(fetchDocs, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [query]);

    // Fetches the next page using the compound cursor and appends to the existing list.
    // No-op when already loading or there are no more pages.
    const loadMore = async () => {
        if (isLoadingMore || nextCursor === null) return;
        setIsLoadingMore(true);
        try {
            const params = new URLSearchParams({
                lastViewedAt: nextCursor.lastViewedAt,
                lastId: String(nextCursor.lastId),
            });
            const res = await axiosClient.get<ApiResponse<DocumentLibraryData>>(
                `/getUserViewedDocs?${params.toString()}`,
            );
            if (res.data.success) {
                setDocuments((prev) => [...prev, ...res.data.data.documents]);
                setNextCursor(res.data.data.nextCursor);
            }
        } catch (err) {
            console.error("useDocumentSearch loadMore failed:", err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    return { query, setQuery, documents, isLoading, isLoadingMore, hasMore: nextCursor !== null, loadMore };
};

export default useDocumentSearch;
