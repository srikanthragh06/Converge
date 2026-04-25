import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import useLibrary from "../../../hooks/useLibrary";
import { timeAgo } from "../../../utils/utils";

/**
 * Full-screen modal overlay for quickly switching between documents.
 * Shows the user's library on open and supports debounced title search.
 * Closes on Escape or backdrop click.
 */
const DocumentSwitcherOverlay = ({ onClose }: { onClose: () => void }) => {
    const { searchText, setSearchText, documents, isLoadingMore } =
        useLibrary(); // library state: search query, document list, and loading flag
    const navigate = useNavigate(); // router navigation for switching to a selected document
    const inputRef = useRef<HTMLInputElement>(null); // ref used to auto-focus the search input on mount

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

    /** Navigates to the selected document and closes the overlay. */
    const handleDocumentClick = (id: number) => {
        navigate(`/document/${id}`);
        onClose();
    };

    return (
        // Backdrop — click outside the modal to close
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50"
            onClick={onClose}
        >
            {/* Modal panel — stop clicks from bubbling to the backdrop */}
            <div
                className="bg-background-elevated rounded-lg w-full max-w-xl mx-4 flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search documents..."
                    className="px-4 py-3 bg-transparent border-b border-border outline-none text-white text-sm"
                />

                {/* Results list */}
                <div className="overflow-y-auto max-h-96 flex flex-col">
                    {isLoadingMore ? (
                        <div className="flex justify-center py-4">
                            <AiOutlineLoading3Quarters className="animate-spin text-text-disabled" />
                        </div>
                    ) : documents.length === 0 ? (
                        <p className="text-text-disabled text-sm text-center py-4">
                            No documents found.
                        </p>
                    ) : (
                        documents.map((doc) => (
                            <div
                                key={doc.id}
                                onClick={() => handleDocumentClick(doc.id)}
                                className="flex flex-col gap-1 px-4 py-2 cursor-pointer hover:bg-background-hover transition"
                            >
                                <span
                                    className={`text-white text-sm font-medium truncate ${!doc.title && "opacity-20"}`}
                                >
                                    {doc.title || "Untitled"}
                                </span>
                                <span className="text-text-disabled text-xs truncate">
                                    {[
                                        doc.ownerName,
                                        `Last visited ${timeAgo(doc.lastVisitedAt)}`,
                                        `Edited ${timeAgo(doc.lastEditedAt)}`,
                                    ].join(" · ")}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentSwitcherOverlay;
