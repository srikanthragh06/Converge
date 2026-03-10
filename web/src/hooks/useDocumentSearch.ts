// Shared hook for fetching and searching the current user's document library.
// When query is empty, fetches GET /getUserViewedDocs (recency order).
// When query is non-empty, fetches GET /searchUserDocs?q=... (trigram similarity).
// Debounces the API call to avoid hammering the server on keystrokes.
// Used by both LibraryPage and DocSearchOverlay so they share the same logic.

import { useState, useEffect, useRef } from "react";
import { axiosClient } from "../lib/axiosClient";
import { ApiResponse, DocumentLibraryData, DocumentLibraryItem } from "../types/api";

const useDocumentSearch = () => {
    // Debounce window before the search fires after the user stops typing.
    const SEARCH_DEBOUNCE_MS = 300;

    const [query, setQuery] = useState("");
    const [documents, setDocuments] = useState<DocumentLibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    // Track the latest fetch request so stale responses are discarded.
    const latestRequestId = useRef(0);

    useEffect(() => {
        const requestId = ++latestRequestId.current;

        const fetchDocs = async () => {
            setIsLoading(true);
            try {
                const trimmed = query.trim();
                const url = trimmed.length > 0
                    ? `/searchUserDocs?q=${encodeURIComponent(trimmed)}`
                    : "/getUserViewedDocs";
                const res = await axiosClient.get<ApiResponse<DocumentLibraryData>>(url);
                // Discard if a newer request has already been issued.
                if (requestId !== latestRequestId.current) return;
                if (res.data.success) setDocuments(res.data.data.documents);
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

    return { query, setQuery, documents, isLoading };
};

export default useDocumentSearch;
