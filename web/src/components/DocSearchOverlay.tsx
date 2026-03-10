// DocSearchOverlay: global Ctrl+P document search overlay.
// Renders when isDocSearchOpenAtom is true. Shows a search input:
// empty → recency-ordered docs from GET /getUserViewedDocs;
// typed → trigram similarity results from GET /searchUserDocs.
// Clicking a doc navigates to /note/:id and closes the overlay.
// Escape key or clicking the backdrop closes the overlay.

import { useEffect, useRef } from "react";
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

    // Auto-focus the input when the overlay opens; clear query on close.
    useEffect(() => {
        if (isOpen) {
            // Small delay to let the CSS transition start before focusing.
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
                // Only close if clicking the backdrop itself, not children.
                if (e.target === e.currentTarget) setIsOpen(false);
            }}
        >
            <div className="w-full max-w-xl mx-4 bg-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden border border-zinc-700">
                {/* Search input */}
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search documents..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full px-4 py-4 bg-transparent text-zinc-100 placeholder-zinc-500 text-sm outline-none border-b border-zinc-700"
                />

                {/* Results list */}
                <div className="max-h-80 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col gap-1 p-2">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="h-10 bg-[#333] rounded animate-pulse"
                                />
                            ))}
                        </div>
                    ) : documents.length === 0 ? (
                        <p className="text-sm text-zinc-500 text-center py-8">
                            {query.trim().length > 0
                                ? "No documents matched."
                                : "No documents yet."}
                        </p>
                    ) : (
                        documents.map((doc) => (
                            <button
                                key={doc.id}
                                onClick={() => handleSelectDoc(doc.id)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#333] active:bg-[#3a3a3a] transition-colors cursor-pointer"
                            >
                                <span className="text-sm text-zinc-100 truncate font-medium">
                                    {doc.title || <span className="text-zinc-500 italic">Untitled</span>}
                                </span>
                                <span className="text-xs text-zinc-500 ml-4 shrink-0">
                                    {formatRelativeTime(doc.lastViewedAt)}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default DocSearchOverlay;
