// DocSearchOverlay: Ctrl+P document search overlay, mounted inside EditorPage.
// Registers the Ctrl+P / Cmd+P shortcut itself — no separate hook needed.
// Renders when isDocSearchOpenAtom is true. Shows a search input:
// empty → recency-ordered docs from GET /getUserViewedDocs;
// typed → trigram similarity results from GET /searchUserDocs.
// Clicking or pressing Enter on a focused doc navigates to /note/:id and closes the overlay.
// Arrow keys move focus through the list; Escape or clicking the backdrop closes it.
// The loading skeleton is delayed 300ms to avoid a flicker on fast fetches.

import { formatRelativeTime } from "../../utils/utils";
import { AccessLevel } from "../../types/api";
import useDocSearchOverlay from "../../hooks/useDocSearchOverlay";

function DocSearchOverlay() {
    // Colour for each access level label shown in search results.
    const ACCESS_LEVEL_CLASSES: Record<AccessLevel, string> = {
        owner: "text-emerald-500",
        admin: "text-purple-400",
        editor: "text-blue-400",
        viewer: "text-zinc-500",
    };

    const {
        isOpen,
        setIsOpen,
        inputRef,
        query,
        setQuery,
        showSkeleton,
        documents,
        focusedIndex,
        setFocusedIndex,
        itemRefs,
        handleSelectDoc,
    } = useDocSearchOverlay();

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
                                <div
                                    key={i}
                                    className="h-9 bg-[#2f2f2f] rounded-lg animate-pulse"
                                />
                            ))}
                        </div>
                    ) : documents.length === 0 ? (
                        <p className="text-sm text-zinc-600 text-center py-6">
                            {query.trim().length > 0
                                ? "No documents matched."
                                : "No documents yet."}
                        </p>
                    ) : (
                        <div className="px-1">
                            {documents.map((doc, i) => (
                                <div
                                    key={doc.id}
                                    ref={(el) => {
                                        itemRefs.current[i] = el;
                                    }}
                                    onClick={() => handleSelectDoc(doc.id)}
                                    onMouseEnter={() => setFocusedIndex(i)}
                                    className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                                        i === focusedIndex ? "bg-[#2f2f2f]" : ""
                                    }`}
                                >
                                    <span
                                        className={`text-sm truncate transition-colors ${
                                            i === focusedIndex
                                                ? "text-zinc-100"
                                                : "text-zinc-300"
                                        }`}
                                    >
                                        {doc.title || (
                                            <span className="text-zinc-600 italic">
                                                Untitled
                                            </span>
                                        )}
                                    </span>
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
                                    {/* Access level label */}
                                    <span
                                        className={`text-xs capitalize ${ACCESS_LEVEL_CLASSES[doc.accessLevel]}`}
                                    >
                                        {doc.accessLevel}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DocSearchOverlay;
