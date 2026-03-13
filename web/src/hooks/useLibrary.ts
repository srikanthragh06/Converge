// useLibrary: encapsulates all state, refs, and effects for LibraryPage.
// Returns everything the page needs for rendering and event handling.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useDocumentSearch from "./useDocumentSearch";
import { axiosClient } from "../lib/axiosClient";
import { ApiResponse, DocumentMetaData } from "../types/api";

function useLibrary() {
    const navigate = useNavigate();
    const {
        query,
        setQuery,
        documents,
        isLoading,
        isLoadingMore,
        hasMore,
        loadMore,
    } = useDocumentSearch();

    // Refs for each list row — used to scroll the keyboard-focused item into view.
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Ref for the sentinel div at the bottom of the list — watched by IntersectionObserver.
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // Only show the skeleton after 300ms — prevents a flash on fast fetches.
    const [showSkeleton, setShowSkeleton] = useState(false);
    // Which item is keyboard-focused (-1 = none).
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // Creates a new document via POST /documents and navigates directly to it.
    const handleNewDocument = async () => {
        try {
            const res =
                await axiosClient.post<ApiResponse<DocumentMetaData>>(
                    "/documents",
                );
            if (res.data.success) navigate(`/note/${res.data.data.id}`);
        } catch (err) {
            console.error("Failed to create document:", err);
        }
    };

    // Only show the loading skeleton after 300ms — prevents a flash on fast fetches.
    useEffect(() => {
        if (!isLoading) {
            setShowSkeleton(false);
            return;
        }
        const timer = setTimeout(() => setShowSkeleton(true), 300);
        return () => clearTimeout(timer);
    }, [isLoading]);

    // Reset focused item whenever the result list changes.
    useEffect(() => {
        setFocusedIndex(-1);
    }, [documents]);

    // Scroll the focused item into view when the index changes.
    useEffect(() => {
        if (focusedIndex >= 0)
            itemRefs.current[focusedIndex]?.scrollIntoView({
                block: "nearest",
            });
    }, [focusedIndex]);

    // Arrow keys navigate the list; Enter opens the focused doc.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedIndex((prev) =>
                    Math.min(prev + 1, documents.length - 1),
                );
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedIndex((prev) => Math.max(prev - 1, 0));
                return;
            }
            if (
                e.key === "Enter" &&
                focusedIndex >= 0 &&
                documents[focusedIndex]
            ) {
                navigate(`/note/${documents[focusedIndex]!.id}`);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [documents, focusedIndex]);

    // IntersectionObserver on the sentinel div — calls loadMore when it becomes visible.
    // Recreated when hasMore or isLoadingMore changes so it doesn't fire stale callbacks.
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasMore) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) loadMore();
            },
            { threshold: 0.1 },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore]);

    return {
        navigate,
        query,
        setQuery,
        documents,
        isLoading,
        isLoadingMore,
        hasMore,
        showSkeleton,
        focusedIndex,
        setFocusedIndex,
        itemRefs,
        sentinelRef,
        handleNewDocument,
    };
}

export default useLibrary;
