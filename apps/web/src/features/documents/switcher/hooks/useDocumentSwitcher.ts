import { useCallback, useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAtom, useAtomValue } from "jotai";
import { useNavigate } from "react-router-dom";
import apiClient from "@/lib/http";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import { searchModeAtom } from "@/atoms/search";
import { documentKeys } from "@/features/documents/queryKeys";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import useKeyboardNav from "@/hooks/useKeyboardNav";
import useSemanticSearch from "./useSemanticSearch";
import type {
    ContentSearchDocumentDto,
    GetLibraryDocumentsResponseDto,
    SearchDocumentContentResponseDto,
    SearchLibraryDocumentsResponseDto,
} from "@converge/shared";

const SWITCHER_PAGE_LIMIT = 6;
const SWITCHER_SEARCH_LIMIT = 5;

/** One document's matching passages as the palette shows them, each passage with its keyboard index. */
export type ContentGroup = {
    documentId: number;
    title: string;
    passages: { url: string; snippet: string; navIndex: number }[];
};

/**
 * Manages the ⌘K palette. With an empty search box it lists the most
 * recently visited documents. In lexical mode, 300ms after typing stops, it
 * loads title matches and content passages together — two requests in
 * parallel, shown once both finish. In semantic mode nothing loads while
 * typing; runSemanticSearch (↵) runs the search. Title matches leave out the
 * open document; passages don't. No infinite scroll — the palette shows a
 * fixed short list.
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
    const text = searchText.trim();
    const isBoxEmpty = text === "";
    const debouncedSearch = useDebouncedValue(text, 300);
    // Clearing the box shows the recent documents at once, without the debounce.
    const query = isBoxEmpty ? "" : debouncedSearch;
    const inputRef = useRef<HTMLInputElement>(null); // focused when the palette opens
    const [mode, setMode] = useAtom(searchModeAtom);
    // The last query submitted with ↵ in semantic mode; runId makes a repeated query run again.
    const [semanticRun, setSemanticRun] = useState<{
        query: string;
        runId: number;
    } | null>(null);

    // Typing in semantic mode loads nothing; the recent list still shows when the box is empty.
    const isListEnabled =
        currentWorkspace !== null && (query === "" || mode === "lexical");
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
                const contentDocuments: ContentSearchDocumentDto[] = [];
                return { titles: data.documents, contentDocuments };
            }
            const [titleResponse, contentResponse] = await Promise.all([
                apiClient.get<SearchLibraryDocumentsResponseDto>(
                    "/document/library/search",
                    {
                        params: {
                            workspaceId,
                            title: query,
                            limit: SWITCHER_SEARCH_LIMIT,
                        },
                    },
                ),
                apiClient.get<SearchDocumentContentResponseDto>(
                    "/document/search/content",
                    { params: { workspaceId, query, mode: "lexical" } },
                ),
            ]);
            return {
                titles: titleResponse.data.documents,
                contentDocuments: contentResponse.data.documents,
            };
        },
        enabled: isListEnabled,
        // Keep the previous results on screen while the next search loads.
        placeholderData: keepPreviousData,
    });
    const titles = (data?.titles ?? []).filter(
        (d) => d.id !== currentDocumentId,
    );
    const contentDocuments = data?.contentDocuments ?? [];

    const semantic = useSemanticSearch(workspaceId, semanticRun);
    // True once the box no longer holds the query the shown semantic results are for.
    const isSemanticQueryEdited =
        semanticRun !== null && semanticRun.query !== text;

    /** Runs a semantic search for the box's text; a repeated query runs again. */
    const runSemanticSearch = () => {
        setSemanticRun((previous) => {
            if (previous === null) return { query: text, runId: 1 };
            return { query: text, runId: previous.runId + 1 };
        });
    };

    /** Switches between lexical and semantic mode. */
    const toggleMode = () => {
        setMode((previous) => {
            if (previous === "lexical") return "semantic";
            return "lexical";
        });
    };

    /** Navigates to the selected document and closes the overlay. */
    const handleDocumentClick = useCallback(
        (id: number) => {
            navigate(`/document/${id}`);
            onClose();
        },
        [navigate, onClose],
    );

    /**
     * Opens a passage — its document, scrolled to the passage's block — and
     * closes the overlay.
     * @param url - the passage's document link, e.g. "/document/6?blockId=…"
     */
    const openPassage = (url: string) => {
        navigate(url);
        onClose();
    };

    // The rows the keyboard moves through, in screen order: the semantic run
    // row, then title rows, then passages. Each row's navIndex is its
    // position in navActions, which holds what ↵ does on it.
    const navActions: (() => void)[] = [];

    let runRowNavIndex: number | null = null;
    const isRunRowShown =
        mode === "semantic" &&
        !isBoxEmpty &&
        (semanticRun === null ||
            isSemanticQueryEdited ||
            semantic.status === "failed");
    if (isRunRowShown) {
        runRowNavIndex = navActions.length;
        navActions.push(runSemanticSearch);
    }

    const titleRows: { id: number; title: string; navIndex: number }[] = [];
    if (isBoxEmpty || mode === "lexical") {
        for (const document of titles) {
            titleRows.push({
                id: document.id,
                title: document.title,
                navIndex: navActions.length,
            });
            navActions.push(() => handleDocumentClick(document.id));
        }
    }

    let shownContentDocuments: ContentSearchDocumentDto[] = [];
    if (!isBoxEmpty && mode === "lexical") {
        shownContentDocuments = contentDocuments;
    } else if (!isBoxEmpty && semantic.status === "done") {
        shownContentDocuments = semantic.documents;
    }
    const contentGroups: ContentGroup[] = [];
    for (const document of shownContentDocuments) {
        const passages: ContentGroup["passages"] = [];
        for (const passage of document.passages) {
            passages.push({
                url: passage.url,
                snippet: passage.snippet,
                navIndex: navActions.length,
            });
            navActions.push(() => openPassage(passage.url));
        }
        contentGroups.push({
            documentId: document.documentId,
            title: document.title,
            passages,
        });
    }

    const { focusedIndex, listRef } = useKeyboardNav(navActions.length, (i) =>
        navActions[i](),
    );

    // Auto-focus the search input when the overlay mounts.
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return {
        searchText,
        setSearchText,
        isBoxEmpty,
        mode,
        toggleMode,
        isLoading: isListEnabled && isPending,
        titleRows,
        contentGroups,
        semanticStatus: semantic.status,
        isSemanticQueryEdited,
        runRowNavIndex,
        runSemanticSearch,
        openPassage,
        handleDocumentClick,
        inputRef,
        focusedIndex,
        listRef,
    };
};

export default useDocumentSwitcher;
