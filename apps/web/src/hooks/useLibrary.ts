import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../lib/http";
import type {
    CreateDocumentResponseDto,
    GetLibraryDocumentsResponseDto,
    LibraryDocumentDto,
    SearchLibraryDocumentsResponseDto,
} from "@converge/shared";

const LIBRARY_PAGE_LIMIT = 12;
const LIBRARY_SEARCH_PAGE_LIMIT = 5;

/**
 * Manages library page state. Fetches documents from GET /document/library
 * with keyset pagination, debounced search, and an IntersectionObserver on
 * the returned sentinelRef to automatically load the next page on scroll.
 */
const useLibrary = () => {
    const navigate = useNavigate();
    const [searchText, setSearchText] = useState(""); // current search query string
    const [documents, setDocuments] = useState<LibraryDocumentDto[]>([]); // accumulated list of fetched documents
    const [isLoadingMore, setIsLoadingMore] = useState(false); // true when a library fetch is in flight
    const [isCreating, setIsCreating] = useState(false); // true while the new-document request is in flight

    const nextCursor = useRef<{ lastVisitedAt: Date; id: number } | null>(null); // compound keyset cursor for the next page
    const hasMoreRef = useRef(true); // whether another page exists — ref so loadMore always reads the latest value without needing to be in its deps

    // Sentinel element stored as state so the observer effect re-runs when it mounts.
    const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
    // Callback ref passed to the sentinel div — React calls this when the element mounts.
    const sentinelRef = useCallback(
        (node: HTMLDivElement | null) => setSentinelEl(node),
        [],
    );

    /** Fetches the first page of the user's library and resets pagination state. */
    const fetchFirstPage = async () => {
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

    /**
     * Fetches documents matching the given title query from the search endpoint.
     * Replaces the current document list and disables infinite scroll.
     */
    const fetchSearchedDocs = async (query: string) => {
        try {
            setIsLoadingMore(true);
            const { data } =
                await apiClient.get<SearchLibraryDocumentsResponseDto>(
                    "/document/library/search",
                    {
                        params: {
                            title: query,
                            limit: LIBRARY_SEARCH_PAGE_LIMIT,
                        },
                    },
                );
            setDocuments(data.documents);
            nextCursor.current = null;
            hasMoreRef.current = false;
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    /**
     * Fetches the next page of documents and appends them to the list.
     * No-ops if a fetch is already in flight or there are no more pages.
     */
    const loadMore = async () => {
        if (isLoadingMore || !hasMoreRef.current || !nextCursor.current) return;

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

    // Debounces searchText and fires the search API 300ms after the user stops typing.
    // When the query is cleared, resets to the first page of the normal library fetch.
    useEffect(() => {
        let timeout: number | null = null;
        if (searchText.trim() === "") {
            fetchFirstPage();
        } else {
            timeout = setTimeout(() => {
                fetchSearchedDocs(searchText.trim());
            }, 300);
        }

        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [searchText]);

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

    /** Calls POST /document to create a new document and navigates to its editor page. */
    const createDocument = async () => {
        if (isCreating) return;
        try {
            setIsCreating(true);
            const { data } =
                await apiClient.post<CreateDocumentResponseDto>("/document");
            navigate(`/document/${data.documentId}`);
        } catch (err) {
            console.error(err);
        } finally {
            setIsCreating(false);
        }
    };

    return {
        searchText,
        setSearchText,
        documents,
        isLoadingMore,
        sentinelRef,
        isCreating,
        createDocument,
    };
};

export default useLibrary;
