import Page from "../../components/Page";
import LibraryDocumentCard from "./components/LibraryDocumentCard";
import useLibrary from "../../hooks/useLibrary";
import AnimatedDots from "../../components/AnimatedDots";
import Skeleton from "../../components/ui/Skeleton";
import DelayedRender from "../../components/DelayedRender";

/**
 * Full-screen library page. Lists the authenticated user's documents
 * with debounced search and infinite scroll.
 */
const LibraryPage = () => {
    const {
        searchText,
        setSearchText,
        documents,
        sentinelRef,
        isLoadingMore,
        isCreating,
        createDocument,
    } = useLibrary(true); // search state, paginated document list, infinite scroll sentinel, and document creation state

    return (
        <>
            <Page authRequired haveSidebar mobileTitle="Library">
                {/* Header — title and search bar, does not scroll */}
                <div className="bg-surface pb-4 pt-4 sm:pt-8 w-full flex flex-col space-y-4">
                    <div className="flex flex-col items-center w-full px-4 sm:px-0">
                        <div className="w-full sm:max-w-[600px]">
                            <div className="text-fg font-bold flex justify-start sm:mb-4 mb-2">
                                <h1 className="sm:text-3xl text-xl">Library</h1>
                            </div>
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
                        </div>
                    </div>
                </div>

                {/* Document list — scrolls independently within the remaining page height */}
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
            </Page>
        </>
    );
};

export default LibraryPage;
