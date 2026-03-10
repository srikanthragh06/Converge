// LibraryPage: shows all documents the current user has viewed, with a search bar
// and a "New Document" CTA. Search empty → recency order; typed → trigram similarity.
// Clicking a row navigates to /note/:id. New Document calls POST /documents then navigates.
// The loading skeleton is delayed 300ms to avoid a flicker on fast loads.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthOverlay from "../components/AuthOverlay";
import useDocumentSearch from "../hooks/useDocumentSearch";
import { axiosClient } from "../lib/axiosClient";
import { ApiResponse, DocumentMetaData } from "../types/api";
import { formatRelativeTime } from "../utils/utils";

function LibraryPage() {
    const navigate = useNavigate();
    const { query, setQuery, documents, isLoading } = useDocumentSearch();

    // Only show the skeleton after 300ms — prevents a flash on fast fetches.
    const [showSkeleton, setShowSkeleton] = useState(false);
    useEffect(() => {
        if (!isLoading) {
            setShowSkeleton(false);
            return;
        }
        const timer = setTimeout(() => setShowSkeleton(true), 300);
        return () => clearTimeout(timer);
    }, [isLoading]);

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

    return (
        <div className="min-h-screen bg-[#1f1f1f] text-zinc-100">
            <AuthOverlay />

            <div className="max-w-2xl mx-auto px-6 pt-12 pb-8">
                {/* Toolbar: search + new doc CTA */}
                <div className="flex items-center gap-3 mb-8">
                    <input
                        type="text"
                        placeholder="Search documents..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#2a2a2a] rounded-lg text-zinc-200 placeholder-zinc-600 text-sm outline-none transition-colors"
                    />
                    <button
                        onClick={handleNewDocument}
                        className="shrink-0 px-3 py-2 bg-[#2a2a2a] hover:bg-[#323232] active:bg-[#2f2f2f] text-zinc-300 text-sm rounded-lg transition-colors cursor-pointer"
                    >
                        New Document
                    </button>
                </div>

                {/* Document list */}
                {showSkeleton ? (
                    <div className="flex flex-col gap-2">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-14 bg-[#252525] rounded-xl animate-pulse"
                            />
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
                        {documents.map((doc) => (
                            <div
                                key={doc.id}
                                onClick={() => navigate(`/note/${doc.id}`)}
                                className="group flex flex-col gap-0.5 px-3 py-3 cursor-pointer"
                            >
                                {/* Title */}
                                <span className="text-sm text-zinc-300 group-hover:text-zinc-100 truncate transition-colors">
                                    {doc.title || (
                                        <span className="text-zinc-600 italic">
                                            Untitled
                                        </span>
                                    )}
                                </span>
                                {/* Metadata line */}
                                <span className="text-xs text-zinc-600 truncate">
                                    {[
                                        doc.createdByName,
                                        `Viewed ${formatRelativeTime(doc.lastViewedAt)}`,
                                        doc.lastEditedAt &&
                                            `Edited ${formatRelativeTime(doc.lastEditedAt)}`,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LibraryPage;
