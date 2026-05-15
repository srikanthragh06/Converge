import { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import apiClient from "../lib/http";
import type {
    GetLibraryDocumentsResponseDto,
    LibraryDocumentDto,
    SearchLibraryDocumentsResponseDto,
} from "@converge/shared";
import { useNavigate } from "react-router-dom";
import useKeyboardNav from "./useKeyboardNav";
import { currentWorkspaceAtom } from "../atoms/sidebar";

const SWITCHER_PAGE_LIMIT = 6;
const SWITCHER_SEARCH_LIMIT = 5;

/**
 * Manages document switcher overlay state. Fetches the first page of the
 * user's library on mount and supports debounced title search. Filters out
 * the currently open document so it never appears in the results.
 * No infinite scroll — the overlay shows a fixed short list.
 * @param currentDocumentId - ID of the document currently open in the editor, excluded from results.
 * @param onClose - Called to close the overlay (on Escape or after navigation).
 */
const useDocumentSwitcher = (
    currentDocumentId: number | undefined,
    onClose: () => void,
) => {
    const navigate = useNavigate(); // router navigation for switching to a selected document
    const currentWorkspace = useAtomValue(currentWorkspaceAtom); // active workspace — its ID is required by both library API calls

    const [searchText, setSearchText] = useState(""); // current search query string
    const [documents, setDocuments] = useState<LibraryDocumentDto[]>([]); // filtered list of fetched documents
    const [isLoading, setIsLoading] = useState(false); // true while an API request is in flight

    const inputRef = useRef<HTMLInputElement>(null); // ref used to auto-focus the search input on mount

    /** Navigates to the selected document and closes the overlay. */
    const handleDocumentClick = useCallback(
        (id: number) => {
            navigate(`/document/${id}`);
            onClose();
        },
        [navigate, onClose],
    );

    const { focusedIndex, listRef } = useKeyboardNav(documents.length, (i) =>
        handleDocumentClick(documents[i].id),
    );

    /** Filters out the currently open document from a raw result list. */
    const filterCurrent = (docs: LibraryDocumentDto[]) =>
        docs.filter((d) => d.id !== currentDocumentId);

    /** Fetches the first page of the user's library. */
    const fetchFirstPage = async () => {
        if (!currentWorkspace) return;
        try {
            setIsLoading(true);
            const { data } =
                await apiClient.get<GetLibraryDocumentsResponseDto>(
                    "/document/library",
                    {
                        params: {
                            workspaceId: currentWorkspace.id,
                            limit: SWITCHER_PAGE_LIMIT,
                        },
                    },
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
        if (!currentWorkspace) return;
        try {
            setIsLoading(true);
            const { data } =
                await apiClient.get<SearchLibraryDocumentsResponseDto>(
                    "/document/library/search",
                    {
                        params: {
                            workspaceId: currentWorkspace.id,
                            title: query,
                            limit: SWITCHER_SEARCH_LIMIT,
                        },
                    },
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
    }, [searchText, currentWorkspace]);

    // Auto-focus the search input when the overlay mounts.
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Close the overlay when the user presses Escape.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return {
        searchText,
        setSearchText,
        documents,
        isLoading,
        inputRef,
        focusedIndex,
        listRef,
        handleDocumentClick,
    };
};

export default useDocumentSwitcher;
