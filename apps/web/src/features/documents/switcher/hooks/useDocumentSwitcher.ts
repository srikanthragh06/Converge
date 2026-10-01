import { useCallback, useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useNavigate } from "react-router-dom";
import apiClient from "@/lib/http";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import { documentKeys } from "@/features/documents/queryKeys";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import useKeyboardNav from "@/hooks/useKeyboardNav";
import type {
    GetLibraryDocumentsResponseDto,
    SearchLibraryDocumentsResponseDto,
} from "@converge/shared";

const SWITCHER_PAGE_LIMIT = 6;
const SWITCHER_SEARCH_LIMIT = 5;

/**
 * Manages the ⌘K palette: the most recently visited documents while the
 * search box is empty, otherwise title search results 300ms after the user
 * stops typing. Leaves out the open document. No infinite scroll — the
 * palette shows a fixed short list.
 * @param currentDocumentId - ID of the document currently open in the editor, excluded from results.
 * @param onClose - Called to close the overlay after navigating to a document.
 */
const useDocumentSwitcher = (
    currentDocumentId: number | undefined,
    onClose: () => void,
) => {
    const navigate = useNavigate();
    const currentWorkspace = useAtomValue(currentWorkspaceAtom);
    const workspaceId = currentWorkspace?.id ?? 0;
    const [searchText, setSearchText] = useState(""); // the search box's text
    const debouncedSearch = useDebouncedValue(searchText.trim(), 300);
    // Clearing the box shows the recent documents at once, without the debounce.
    const query = searchText.trim() === "" ? "" : debouncedSearch;
    const inputRef = useRef<HTMLInputElement>(null); // focused when the palette opens

    const { data, isPending } = useQuery({
        queryKey: documentKeys.switcher(workspaceId, query),
        queryFn: async () => {
            if (query === "") {
                const { data } =
                    await apiClient.get<GetLibraryDocumentsResponseDto>(
                        "/document/library",
                        {
                            params: { workspaceId, limit: SWITCHER_PAGE_LIMIT },
                        },
                    );
                return data.documents;
            }
            const { data } =
                await apiClient.get<SearchLibraryDocumentsResponseDto>(
                    "/document/library/search",
                    {
                        params: {
                            workspaceId,
                            title: query,
                            limit: SWITCHER_SEARCH_LIMIT,
                        },
                    },
                );
            return data.documents;
        },
        enabled: currentWorkspace !== null,
        // Keep the previous results on screen while the next search loads.
        placeholderData: keepPreviousData,
    });
    const documents = (data ?? []).filter((d) => d.id !== currentDocumentId);

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

    // Auto-focus the search input when the overlay mounts.
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return {
        searchText,
        setSearchText,
        documents,
        isLoading: isPending,
        inputRef,
        focusedIndex,
        listRef,
        handleDocumentClick,
    };
};

export default useDocumentSwitcher;
