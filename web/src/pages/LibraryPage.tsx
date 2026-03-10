// LibraryPage: shows all documents the current user has viewed, with a search bar
// and a "New Document" CTA. Search empty → recency order; typed → trigram similarity.
// Clicking a row navigates to /note/:id. New Document calls POST /documents then navigates.

import { useNavigate } from "react-router-dom";
import AuthOverlay from "../components/AuthOverlay";
import useDocumentSearch from "../hooks/useDocumentSearch";
import { axiosClient } from "../lib/axiosClient";
import { ApiResponse, DocumentMetaData } from "../types/api";
import { formatRelativeTime } from "../utils/utils";

function LibraryPage() {
    const navigate = useNavigate();
    const { query, setQuery, documents, isLoading } = useDocumentSearch();

    const handleNewDocument = async () => {
        try {
            const res = await axiosClient.post<ApiResponse<DocumentMetaData>>("/documents");
            if (res.data.success) navigate(`/note/${res.data.data.id}`);
        } catch (err) {
            console.error("Failed to create document:", err);
        }
    };

    const handleOpenDoc = (id: number) => {
        navigate(`/note/${id}`);
    };

    return (
        <div className="min-h-screen bg-[#1f1f1f] text-zinc-100">
            <AuthOverlay />

            {/* Page header */}
            <div className="max-w-4xl mx-auto px-6 pt-16 pb-8">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-zinc-100">Library</h1>
                    <button
                        onClick={handleNewDocument}
                        className="px-4 py-2 bg-zinc-100 hover:bg-white active:bg-zinc-200 text-zinc-900 text-sm font-medium rounded-lg transition-colors cursor-pointer"
                    >
                        New Document
                    </button>
                </div>

                {/* Search bar */}
                <input
                    type="text"
                    placeholder="Search documents..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full px-4 py-3 bg-[#2a2a2a] border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 text-sm outline-none focus:border-zinc-500 transition-colors mb-6"
                />

                {/* Document table */}
                {isLoading ? (
                    // Loading skeleton: three placeholder rows
                    <div className="flex flex-col gap-2">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-12 bg-[#2a2a2a] rounded-lg animate-pulse"
                            />
                        ))}
                    </div>
                ) : documents.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-12">
                        {query.trim().length > 0
                            ? "No documents matched your search."
                            : "You haven't viewed any documents yet. Create one to get started."}
                    </p>
                ) : (
                    <div className="rounded-lg overflow-hidden border border-zinc-800">
                        {/* Table header */}
                        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-4 py-2 bg-[#252525] text-xs text-zinc-500 font-medium uppercase tracking-wide">
                            <span>Title</span>
                            <span>Created By</span>
                            <span>Last Viewed</span>
                            <span>Last Edited</span>
                        </div>

                        {/* Table rows */}
                        {documents.map((doc) => (
                            <button
                                key={doc.id}
                                onClick={() => handleOpenDoc(doc.id)}
                                className="w-full grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-4 py-3 text-left bg-transparent hover:bg-[#2a2a2a] active:bg-[#303030] border-t border-zinc-800 transition-colors cursor-pointer"
                            >
                                <span className="text-sm text-zinc-100 truncate font-medium">
                                    {doc.title || <span className="text-zinc-500 italic">Untitled</span>}
                                </span>
                                <span className="text-sm text-zinc-400 truncate">
                                    {doc.createdByName ?? "—"}
                                </span>
                                <span className="text-sm text-zinc-400">
                                    {formatRelativeTime(doc.lastViewedAt)}
                                </span>
                                <span className="text-sm text-zinc-400">
                                    {doc.lastEditedAt ? formatRelativeTime(doc.lastEditedAt) : "—"}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default LibraryPage;
