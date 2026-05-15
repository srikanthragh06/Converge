import Page from "../../components/Page";
import LibraryDocumentCard from "./components/LibraryDocumentCard";
import useLibrary from "../../hooks/useLibrary";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import AnimatedDots from "../../components/AnimatedDots";

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
    } = useLibrary(); // search state, paginated document list, infinite scroll sentinel, and document creation state

    return (
        <Page authRequired haveSidebar>
            <div
                className=" mr-10 bg-background-base sticky top-[52px] sm:top-[76px] z-40 pb-4 pt-4 sm:pt-8 w-full
                    flex flex-col space-y-4"
            >
                <div
                    className="text-text-primary px-4 sm:px-8 font-bold 
                                flex sm:justify-center justify-start"
                >
                    <h1 className="sm:text-4xl text-2xl sm:mr-[560px]">
                        Library
                    </h1>
                </div>
                <div className="w-full flex flex-col items-center space-y-2 sm:flex-row sm:justify-center sm:space-y-0 sm:space-x-8">
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
                        onClick={createDocument}
                        disabled={isCreating}
                        className="hidden sm:block sm:px-3 sm:py-1 px-2 py-1 sm:text-sm text-xs rounded-md bg-white text-black
                         hover:opacity-90 active:opacity-80 transition
                        cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>
                            {isCreating ? "Creating" : "New Document"}
                            {isCreating && <AnimatedDots />}
                        </span>
                    </button>
                </div>
            </div>
            <div className="flex flex-col items-center w-full mb-16 sm:mb-6">
                {documents.map((doc) => (
                    <LibraryDocumentCard key={doc.id} document={doc} />
                ))}
                {isLoadingMore && (
                    <AiOutlineLoading3Quarters className=" animate-spin" />
                )}
                <div ref={sentinelRef} />
            </div>
            {/* <div className="sm:hidden fixed bottom-0 left-0 right-0 px-4">
                <button
                    onClick={createDocument}
                    disabled={isCreating}
                    className="w-full px-2 py-2 text-xs rounded-md bg-white text-black hover:opacity-90 active:opacity-80 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span>
                        {isCreating ? "Creating" : "New Document"}
                        {isCreating && <AnimatedDots />}
                    </span>
                </button>
            </div> */}
        </Page>
    );
};

export default LibraryPage;
