// Shared hook for fetching and searching the current user's document library.
// When query is empty, fetches GET /getUserViewedDocs (recency order, paginated).
// When query is non-empty, fetches GET /searchUserDocs?q=... (trigram similarity, not paginated).
// Debounces the API call to avoid hammering the server on keystrokes.
// loadMore appends the next page using the compound cursor (lastViewedAt, lastId).
// Used by both LibraryPage and DocSearchOverlay so they share the same logic.

import { useState, useEffect, useRef } from "react";
import { axiosClient } from "../lib/axiosClient";
import {
    ApiResponse,
    DocumentLibraryData,
    DocumentLibraryItem,
    DocumentSearchData,
} from "../types/api";

const useDocumentSearch = () => {
    // Number of documents to request per page from the server.
    const PAGE_SIZE = 20;
    // Debounce window before the search fires after the user stops typing.
    const SEARCH_DEBOUNCE_MS = 300;

    // Current search input — empty string means "show recency list".
    const [query, setQuery] = useState("");

    // The result set currently displayed — replaced on every new fetch, appended on loadMore.
    const [documents, setDocuments] = useState<DocumentLibraryItem[]>([]);

    // True while the initial fetch (or a new query fetch) is in flight.
    const [isLoading, setIsLoading] = useState(false);

    // True while a loadMore (next-page) fetch is in flight.
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Compound cursor for the next page; null means no more pages (or search mode).
    const [nextCursor, setNextCursor] = useState<{
        lastId: number;
        lastViewedAt: string;
    } | null>(null);

    // Track the latest fetch request so stale responses are discarded.
    const latestRequestId = useRef(0);

    // Reset and fetch the first page whenever the query changes.
    useEffect(() => {
        // Stamp this request so responses from superseded fetches can be discarded.
        const requestId = ++latestRequestId.current;

        // Inner async function — useEffect callbacks cannot be async directly.
        const fetchDocs = async () => {
            setIsLoading(true);
            setDocuments([]);
            setNextCursor(null);
            try {
                const trimmedQuery = query.trim();
                if (trimmedQuery.length > 0) {
                    const res = await axiosClient.get<
                        ApiResponse<DocumentSearchData>
                    >(`/searchUserDocs?q=${encodeURIComponent(trimmedQuery)}`);
                    if (requestId !== latestRequestId.current) return;
                    const body = res.data;
                    if (body.success) setDocuments(body.data.documents);
                } else {
                    const res = await axiosClient.get<
                        ApiResponse<DocumentLibraryData>
                    >(`/getUserViewedDocs?limit=${PAGE_SIZE}`);
                    if (requestId !== latestRequestId.current) return;
                    const body = res.data;
                    if (body.success) {
                        setDocuments(body.data.documents);
                        setNextCursor(body.data.nextCursor);
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
                limit: String(PAGE_SIZE),
                lastViewedAt: nextCursor.lastViewedAt,
                lastId: String(nextCursor.lastId),
            });
            const res = await axiosClient.get<ApiResponse<DocumentLibraryData>>(
                `/getUserViewedDocs?${params.toString()}`,
            );
            const body = res.data;
            if (body.success) {
                setDocuments((prev) => [...prev, ...body.data.documents]);
                setNextCursor(body.data.nextCursor);
            }
        } catch (err) {
            console.error("useDocumentSearch loadMore failed:", err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    return {
        query,
        setQuery,
        documents,
        isLoading,
        isLoadingMore,
        hasMore: nextCursor !== null,
        loadMore,
    };
};

export default useDocumentSearch;
