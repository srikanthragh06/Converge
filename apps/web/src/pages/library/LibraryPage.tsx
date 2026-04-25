import Page from "../../components/Page";
import LibraryDocumentCard from "./components/LibraryDocumentCard";
import useLibrary from "../../hooks/useLibrary";

/**
 * Full-screen library page. Lists the authenticated user's documents
 * with search, sorting, and infinite scroll.
 */
const LibraryPage = () => {
    const { searchText, setSearchText, documents, sentinelRef, isLoadingMore } =
        useLibrary();

    return (
        <Page authRequired className="items-center">
            <div
                className="bg-background-base sticky top-0 sm:pt-8 pt-4 pb-4 flex flex-col items-center space-y-2 w-full
                    sm:flex-row sm:items-center sm:space-y-0 sm:space-x-8 mx-2 
                    sm:w-auto"
            >
                <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search documents..."
                    className="sm:w-[500px] w-5/6 px-3 py-1 sm:text-base text-sm rounded-md 
                        bg-background-elevated 
                        outline-none text-white border-0"
                />
                <button
                    className="hidden sm:block sm:px-3 sm:py-1 px-2 py-1 sm:text-sm text-xs rounded-md bg-white text-black
                         hover:opacity-90 active:opacity-80 transition
                        cursor-pointer"
                >
                    New Document
                </button>
            </div>
            <div className="flex flex-col items-center justify-center gap-4 w-full mb-16 sm:mb-6">
                {documents.map((doc) => (
                    <LibraryDocumentCard key={doc.id} document={doc} />
                ))}
                {isLoadingMore && (
                    <span className="text-text-disabled text-sm py-2">
                        Loading...
                    </span>
                )}
                <div ref={sentinelRef} />
            </div>
            <div className="sm:hidden fixed bottom-0 left-0 right-0 px-4">
                <button className="w-full px-2 py-2 text-xs rounded-md bg-white text-black hover:opacity-90 active:opacity-80 transition cursor-pointer">
                    New Document
                </button>
            </div>
        </Page>
    );
};

export default LibraryPage;
