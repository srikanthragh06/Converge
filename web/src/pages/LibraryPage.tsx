// LibraryPage: shows all documents the current user has viewed, with a search bar
// and a "New Document" CTA. Search empty → recency order with scroll pagination;
// typed → trigram similarity (not paginated). Clicking or pressing Enter on a focused
// item navigates to /note/:id. Arrow keys move focus through the list.
// The loading skeleton is delayed 300ms. An IntersectionObserver on a sentinel div
// at the bottom of the list triggers loadMore when the user scrolls near the end.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AuthOverlay from "../components/AuthOverlay";
import useDocumentSearch from "../hooks/useDocumentSearch";
import { axiosClient } from "../lib/axiosClient";
import { ApiResponse, DocumentMetaData } from "../types/api";
import { formatRelativeTime } from "../utils/utils";

function LibraryPage() {
    const navigate = useNavigate();
    const { query, setQuery, documents, isLoading, isLoadingMore, hasMore, loadMore } = useDocumentSearch();
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    // Sentinel div observed by IntersectionObserver to trigger pagination.
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // Only show the skeleton after 300ms — prevents a flash on fast fetches.
    const [showSkeleton, setShowSkeleton] = useState(false);
    useEffect(() => {
        if (!isLoading) { setShowSkeleton(false); return; }
        const timer = setTimeout(() => setShowSkeleton(true), 300);
        return () => clearTimeout(timer);
    }, [isLoading]);

    // Which item is keyboard-focused (-1 = none).
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // Reset focused item whenever the result list changes.
    useEffect(() => { setFocusedIndex(-1); }, [documents]);

    // Scroll the focused item into view when the index changes.
    useEffect(() => {
        if (focusedIndex >= 0) itemRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }, [focusedIndex]);

    // Arrow keys navigate the list; Enter opens the focused doc.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedIndex((prev) => Math.min(prev + 1, documents.length - 1));
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedIndex((prev) => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === "Enter" && focusedIndex >= 0 && documents[focusedIndex]) {
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

    const handleNewDocument = async () => {
        try {
            const res = await axiosClient.post<ApiResponse<DocumentMetaData>>("/documents");
            if (res.data.success) navigate(`/note/${res.data.data.id}`);
        } catch (err) {
            console.error("Failed to create document:", err);
        }
    };

    return (
        <div className="min-h-screen bg-[#1f1f1f] text-zinc-100">
            <AuthOverlay />

            <div className="max-w-2xl mx-auto px-6 pt-12 pb-8">
                {/* Toolbar: search + new doc CTA */}
                <div className="flex items-center gap-2 mb-8">
                    <input
                        type="text"
                        placeholder="Search documents..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-transparent border border-zinc-800 focus:border-zinc-600 rounded-md text-zinc-300 placeholder-zinc-600 text-sm outline-none transition-colors"
                    />
                    <button
                        onClick={handleNewDocument}
                        className="shrink-0 px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors cursor-pointer"
                    >
                        New Document
                    </button>
                </div>

                {/* Document list */}
                {showSkeleton ? (
                    <div className="flex flex-col gap-2">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-14 bg-[#252525] rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : documents.length === 0 ? (
                    <p className="text-sm text-zinc-600 text-center py-16">
                        {query.trim().length > 0
                            ? "No documents matched your search."
                            : "No documents yet. Create one to get started."}
                    </p>
                ) : (
                    <div className="flex flex-col">
                        {documents.map((doc, i) => (
                            <div
                                key={doc.id}
                                ref={(el) => { itemRefs.current[i] = el; }}
                                onClick={() => navigate(`/note/${doc.id}`)}
                                onMouseEnter={() => setFocusedIndex(i)}
                                onMouseLeave={() => setFocusedIndex(-1)}
                                className={`flex flex-col gap-0.5 px-3 py-3 rounded-xl cursor-pointer transition-colors ${
                                    i === focusedIndex ? "bg-[#252525]" : ""
                                }`}
                            >
                                <span className={`font-extrabold text-sm truncate transition-colors ${
                                    i === focusedIndex ? "text-zinc-100" : "text-zinc-300"
                                }`}>
                                    {doc.title || <span className="text-zinc-600 italic">Untitled</span>}
                                </span>
                                <span className="text-xs text-zinc-600 truncate">
                                    {[
                                        doc.createdByName,
                                        `Viewed ${formatRelativeTime(doc.lastViewedAt)}`,
                                        doc.lastEditedAt && `Edited ${formatRelativeTime(doc.lastEditedAt)}`,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </span>
                            </div>
                        ))}

                        {/* Sentinel observed by IntersectionObserver to trigger loadMore */}
                        <div ref={sentinelRef} className="h-1" />

                        {/* Spinner shown while fetching the next page */}
                        {isLoadingMore && (
                            <div className="flex justify-center py-4">
                                <div className="w-4 h-4 border border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LibraryPage;
