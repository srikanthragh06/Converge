// DocSearchOverlay: global Ctrl+P document search overlay.
// Renders when isDocSearchOpenAtom is true. Shows a search input:
// empty → recency-ordered docs from GET /getUserViewedDocs;
// typed → trigram similarity results from GET /searchUserDocs.
// Clicking a doc navigates to /note/:id and closes the overlay.
// Escape key or clicking the backdrop closes the overlay.
// The loading skeleton is delayed 300ms to avoid a flicker on fast fetches.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { isDocSearchOpenAtom } from "../atoms/uiAtoms";
import useDocumentSearch from "../hooks/useDocumentSearch";
import { formatRelativeTime } from "../utils/utils";

function DocSearchOverlay() {
    const [isOpen, setIsOpen] = useAtom(isDocSearchOpenAtom);
    const navigate = useNavigate();
    const { query, setQuery, documents, isLoading } = useDocumentSearch();
    const inputRef = useRef<HTMLInputElement>(null);

    // Only show the skeleton after 300ms — prevents a flash on fast fetches.
    const [showSkeleton, setShowSkeleton] = useState(false);
    useEffect(() => {
        if (!isLoading) { setShowSkeleton(false); return; }
        const timer = setTimeout(() => setShowSkeleton(true), 300);
        return () => clearTimeout(timer);
    }, [isLoading]);

    // Auto-focus the input when the overlay opens; clear query on close.
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery("");
        }
    }, [isOpen]);

    // Close on Escape key.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleSelectDoc = (id: number) => {
        navigate(`/note/${id}`);
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        // Backdrop — click outside the panel to close.
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-sm"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) setIsOpen(false);
            }}
        >
            <div className="w-full max-w-xl mx-4 bg-[#252525] rounded-xl shadow-2xl overflow-hidden">
                {/* Search input */}
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search documents..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full px-4 py-3 bg-transparent text-zinc-200 placeholder-zinc-600 text-sm outline-none border-b border-zinc-700/40"
                />

                {/* Results list */}
                <div className="max-h-72 overflow-y-auto py-1">
                    {showSkeleton ? (
                        <div className="flex flex-col gap-1 px-2 py-1">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="h-9 bg-[#2f2f2f] rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : documents.length === 0 ? (
                        <p className="text-sm text-zinc-600 text-center py-6">
                            {query.trim().length > 0 ? "No documents matched." : "No documents yet."}
                        </p>
                    ) : (
                        <div className="px-1">
                            {documents.map((doc) => (
                                <button
                                    key={doc.id}
                                    onClick={() => handleSelectDoc(doc.id)}
                                    className="group w-full flex flex-col gap-0.5 px-3 py-2.5 text-left bg-transparent hover:bg-[#2f2f2f] active:bg-[#363636] rounded-lg transition-colors cursor-pointer"
                                >
                                    <span className="text-sm text-zinc-200 group-hover:text-zinc-100 truncate transition-colors">
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
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DocSearchOverlay;
