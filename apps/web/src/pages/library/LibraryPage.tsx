import { useState } from "react";
import Page from "../../components/Page";
import LibraryDocumentCard from "./components/LibraryDocumentCard";
import useLibrary from "../../hooks/useLibrary";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import AnimatedDots from "../../components/AnimatedDots";
import ManageDocumentModal from "../editor/manageDocumentModal/ManageDocumentModal";
import useDocumentSwitcherShortcut from "../../hooks/useDocumentSwitcherShortcut";
import DocumentSwitcherOverlay from "../editor/documentSwitcherOverlay/DocumentSwitcherOverlay";

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
    const { isSwitcherOpen, setIsSwitcherOpen } = useDocumentSwitcherShortcut(); // Ctrl+P document switcher overlay state
    const [managingDocumentId, setManagingDocumentId] = useState<number | null>(
        null,
    ); // ID of the document whose manage modal is open; null when closed

    return (
        <>
            <Page authRequired haveSidebar>
                {/* Header — title and search bar, does not scroll */}
                <div className="bg-background-base pb-4 pt-4 sm:pt-8 w-full flex flex-col space-y-4">
                    <div className="flex flex-col items-center w-full px-4 sm:px-0">
                        <div className="w-full sm:max-w-[600px]">
                            <div className="text-text-primary font-bold flex justify-start sm:mb-4 mb-2">
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
                                bg-background-elevated
                                outline-none text-white border-0"
                                />
                                <button
                                    onClick={createDocument}
                                    disabled={isCreating}
                                    className="sm:px-3 sm:py-1 px-2 py-1 sm:text-sm text-xs rounded-md bg-white text-black
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
                    {documents.map((doc) => (
                        <LibraryDocumentCard
                            key={doc.id}
                            document={doc}
                            onManage={setManagingDocumentId}
                        />
                    ))}
                    {isLoadingMore && (
                        <AiOutlineLoading3Quarters className="animate-spin mt-2" />
                    )}
                    <div ref={sentinelRef} />
                </div>
            </Page>
            {managingDocumentId !== null && (
                <ManageDocumentModal
                    documentId={String(managingDocumentId)}
                    onClose={() => setManagingDocumentId(null)}
                />
            )}
            {isSwitcherOpen && (
                <DocumentSwitcherOverlay
                    onClose={() => setIsSwitcherOpen(false)}
                    documentId={undefined}
                />
            )}
        </>
    );
};

export default LibraryPage;
