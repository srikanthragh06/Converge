import { useState } from "react";
import Page from "../../components/Page";
import LibraryDocumentCard from "./components/LibraryDocumentCard";
import TrashDocumentCard from "./components/TrashDocumentCard";
import useLibrary from "../../hooks/useLibrary";
import useTrash from "../../hooks/useTrash";
import AnimatedDots from "../../components/AnimatedDots";
import Skeleton from "../../components/ui/Skeleton";
import DelayedRender from "../../components/DelayedRender";

/**
 * Full-screen library page. Lists the authenticated user's documents
 * with debounced search and infinite scroll, and a Trash tab for
 * browsing and restoring soft-deleted documents.
 * @param initialView - the tab shown first: "library" (default) or "trash",
 *                      which the /trash route uses until Trash gets its own page
 */
const LibraryPage = ({
    initialView = "library",
}: {
    initialView?: "library" | "trash";
}) => {
    const [view, setView] = useState<"library" | "trash">(initialView); // which tab — Library or Trash — is currently shown
    const {
        searchText,
        setSearchText,
        documents,
        sentinelRef,
        isLoadingMore,
        isCreating,
        createDocument,
    } = useLibrary(view === "library"); // search state, paginated document list, infinite scroll sentinel, and document creation state — only fetches while the Library tab is active
    const {
        documents: trashedDocuments,
        sentinelRef: trashSentinelRef,
        isLoadingMore: isTrashLoadingMore,
        restoringId,
        restoreDocument,
    } = useTrash(view === "trash"); // paginated trashed-document list, infinite scroll sentinel, and restore state — only fetches while the Trash tab is active

    return (
        <>
            <Page
                authRequired
                haveSidebar
                mobileTitle={view === "trash" ? "Trash" : "Library"}
            >
                {/* Header — title, Library/Trash tabs, and (Library only) search bar, does not scroll */}
                <div className="bg-surface pb-4 pt-4 sm:pt-8 w-full flex flex-col space-y-4">
                    <div className="flex flex-col items-center w-full px-4 sm:px-0">
                        <div className="w-full sm:max-w-[600px]">
                            <div className="text-fg font-bold flex justify-start sm:mb-4 mb-2">
                                <h1 className="sm:text-3xl text-xl">Library</h1>
                            </div>
                            {/* Tab toggle between the active document list and the trash */}
                            <div className="flex flex-row items-center space-x-4 mb-3 sm:mb-4">
                                <button
                                    onClick={() => setView("library")}
                                    className={`text-sm pb-1 border-b-2 transition cursor-pointer ${
                                        view === "library"
                                            ? "border-fg text-fg"
                                            : "border-transparent text-fg-secondary hover:opacity-80"
                                    }`}
                                >
                                    Library
                                </button>
                                <button
                                    onClick={() => setView("trash")}
                                    className={`text-sm pb-1 border-b-2 transition cursor-pointer ${
                                        view === "trash"
                                            ? "border-fg text-fg"
                                            : "border-transparent text-fg-secondary hover:opacity-80"
                                    }`}
                                >
                                    Trash
                                </button>
                            </div>
                            {view === "library" && (
                                <div className="w-full flex flex-row items-center justify-start space-x-2 sm:space-x-4">
                                    <input
                                        type="text"
                                        value={searchText}
                                        onChange={(e) =>
                                            setSearchText(e.target.value)
                                        }
                                        placeholder="Search documents..."
                                        className="flex-1 px-3 py-1 sm:text-base text-sm rounded-md
                                    bg-surface-elevated
                                    outline-none text-fg border-0"
                                    />
                                    <button
                                        onClick={createDocument}
                                        disabled={isCreating}
                                        className="sm:px-3 sm:py-1 px-2 py-1 sm:text-sm text-xs rounded-md bg-gold text-gold-fg
                                     hover:opacity-90 active:opacity-80 transition
                                    cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span className="sm:hidden">+</span>
                                        <span className="hidden sm:inline">
                                            {isCreating
                                                ? "Creating"
                                                : "New Document"}
                                            {isCreating && <AnimatedDots />}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Document list — scrolls independently within the remaining page height */}
                {view === "library" && (
                    <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1 pb-6">
                        {documents.length === 0 && isLoadingMore && (
                            <DelayedRender>
                                <div className="w-full sm:max-w-[600px] flex flex-col gap-1 px-4 sm:px-0 mt-1">
                                    <Skeleton height="3.5rem" width="100%" />
                                    <Skeleton height="3.5rem" width="100%" />
                                    <Skeleton height="3.5rem" width="100%" />
                                    <Skeleton height="3.5rem" width="100%" />
                                    <Skeleton height="3.5rem" width="100%" />
                                </div>
                            </DelayedRender>
                        )}
                        {documents.map((doc) => (
                            <LibraryDocumentCard key={doc.id} document={doc} />
                        ))}
                        {documents.length > 0 && isLoadingMore && (
                            <DelayedRender>
                                <div className="w-full sm:max-w-[600px] flex flex-col gap-1 px-4 sm:px-0 mt-1">
                                    <Skeleton height="3.5rem" width="100%" />
                                    <Skeleton height="3.5rem" width="100%" />
                                </div>
                            </DelayedRender>
                        )}
                        <div ref={sentinelRef} />
                    </div>
                )}

                {/* Trash list — same scroll/skeleton/infinite-scroll shape as the library list above */}
                {view === "trash" && (
                    <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1 pb-6">
                        {trashedDocuments.length === 0 &&
                            isTrashLoadingMore && (
                                <DelayedRender>
                                    <div className="w-full sm:max-w-[600px] flex flex-col gap-1 px-4 sm:px-0 mt-1">
                                        <Skeleton
                                            height="3.5rem"
                                            width="100%"
                                        />
                                        <Skeleton
                                            height="3.5rem"
                                            width="100%"
                                        />
                                        <Skeleton
                                            height="3.5rem"
                                            width="100%"
                                        />
                                    </div>
                                </DelayedRender>
                            )}
                        {trashedDocuments.length === 0 &&
                            !isTrashLoadingMore && (
                                <span className="text-sm opacity-40 mt-8">
                                    Trash is empty
                                </span>
                            )}
                        {trashedDocuments.map((doc) => (
                            <TrashDocumentCard
                                key={doc.id}
                                document={doc}
                                isRestoring={restoringId === doc.id}
                                onRestore={restoreDocument}
                            />
                        ))}
                        {trashedDocuments.length > 0 && isTrashLoadingMore && (
                            <DelayedRender>
                                <div className="w-full sm:max-w-[600px] flex flex-col gap-1 px-4 sm:px-0 mt-1">
                                    <Skeleton height="3.5rem" width="100%" />
                                    <Skeleton height="3.5rem" width="100%" />
                                </div>
                            </DelayedRender>
                        )}
                        <div ref={trashSentinelRef} />
                    </div>
                )}
            </Page>
        </>
    );
};

export default LibraryPage;
