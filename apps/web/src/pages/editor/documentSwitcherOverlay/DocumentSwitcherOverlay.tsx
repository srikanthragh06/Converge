import useDocumentSwitcher from "../../../hooks/useDocumentSwitcher";
import { Skeleton } from "primereact/skeleton";
import DelayedRender from "../../../components/DelayedRender";
import { timeAgo, formatAccessLevel } from "../../../utils/utils";

/**
 * Full-screen modal overlay for quickly switching between documents.
 * Shows the user's library on open and supports debounced title search.
 * Closes on Escape or backdrop click.
 */
const DocumentSwitcherOverlay = ({
    onClose,
    documentId,
}: {
    /** Called to close the overlay on Escape, backdrop click, or navigation. */
    onClose: () => void;
    documentId: string | undefined; // ID of the currently open document, passed from EditorPage
}) => {
    const {
        searchText,
        setSearchText,
        documents,
        isLoading,
        inputRef,
        listRef,
        handleDocumentClick,
        focusedIndex,
    } = useDocumentSwitcher(
        documentId ? Number(documentId) : undefined,
        onClose,
    ); // switcher state: search query, filtered document list, and loading flag

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
                    className="w-full px-3 py-2 sm:text-sm text-xs rounded-md
                        bg-background-base
                        outline-none text-white border-0 border-b border-none"
                />

                {/* Results list */}
                <div
                    ref={listRef}
                    className="overflow-y-auto max-h-96 flex flex-col"
                >
                    {isLoading ? (
                        <DelayedRender>
                            <div className="flex flex-col gap-1 p-2">
                                <Skeleton height="3.5rem" width="100%" />
                                <Skeleton height="3.5rem" width="100%" />
                                <Skeleton height="3.5rem" width="100%" />
                                <Skeleton height="3.5rem" width="100%" />
                            </div>
                        </DelayedRender>
                    ) : documents.length === 0 ? (
                        <p className="text-text-disabled text-sm text-center py-4">
                            No documents found.
                        </p>
                    ) : (
                        documents.map((doc, i) => (
                            <div
                                key={doc.id}
                                onClick={() => handleDocumentClick(doc.id)}
                                className="group bg-background-base flex flex-col gap-1 px-4 py-2 cursor-pointer"
                            >
                                <div
                                    className={`flex flex-col gap-1 transition group-hover:opacity-100 group-active:opacity-60 ${focusedIndex === i ? "opacity-90" : "opacity-50"}`}
                                >
                                    <span
                                        className={`text-white text-sm font-medium truncate ${!doc.title && "opacity-20"}`}
                                    >
                                        {doc.title || "Untitled"}
                                    </span>
                                    <span className="text-text-disabled text-xs truncate">
                                        {[
                                            formatAccessLevel(doc.access),
                                            `Last visited ${timeAgo(doc.lastVisitedAt || "")}`,
                                            `Edited ${timeAgo(doc.lastEditedAt || "")}`,
                                        ].join(" · ")}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentSwitcherOverlay;
