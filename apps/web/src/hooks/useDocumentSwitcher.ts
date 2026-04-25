import { useEffect, useState } from "react";
import apiClient from "../lib/http";
import type {
    GetLibraryDocumentsResponseDto,
    LibraryDocumentDto,
    SearchLibraryDocumentsResponseDto,
} from "@converge/shared";

const SWITCHER_PAGE_LIMIT = 6;
const SWITCHER_SEARCH_LIMIT = 5;

/**
 * Manages document switcher overlay state. Fetches the first page of the
 * user's library on mount and supports debounced title search. Filters out
 * the currently open document so it never appears in the results.
 * No infinite scroll — the overlay shows a fixed short list.
 * @param currentDocumentId - ID of the document currently open in the editor, excluded from results.
 */
const useDocumentSwitcher = (currentDocumentId: number | undefined) => {
    const [searchText, setSearchText] = useState(""); // current search query string
    const [documents, setDocuments] = useState<LibraryDocumentDto[]>([]); // filtered list of fetched documents
    const [isLoading, setIsLoading] = useState(false); // true while an API request is in flight

    /** Filters out the currently open document from a raw result list. */
    const filterCurrent = (docs: LibraryDocumentDto[]) =>
        docs.filter((d) => d.id !== currentDocumentId);

    /** Fetches the first page of the user's library. */
    const fetchFirstPage = async () => {
        try {
            setIsLoading(true);
            const { data } =
                await apiClient.get<GetLibraryDocumentsResponseDto>(
                    "/document/library",
                    { params: { limit: SWITCHER_PAGE_LIMIT } },
                );
            setDocuments(filterCurrent(data.documents));
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    /** Fetches documents matching the given title query from the search endpoint. */
    const fetchSearchedDocs = async (query: string) => {
        try {
            setIsLoading(true);
            const { data } =
                await apiClient.get<SearchLibraryDocumentsResponseDto>(
                    "/document/library/search",
                    { params: { title: query, limit: SWITCHER_SEARCH_LIMIT } },
                );
            setDocuments(filterCurrent(data.documents));
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Debounces searchText and fires the search API 300ms after the user stops typing.
    // When the query is cleared, resets to the first page of the library.
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

    return { searchText, setSearchText, documents, isLoading };
};

export default useDocumentSwitcher;
