import { formatDate, hasAccess } from "../../../../utils/utils";
import DeleteDocumentConfirmationModal from "./DeleteDocumentConfirmationModal";
import useOverviewTab from "../../../../hooks/useOverviewTab";
import AnimatedDots from "../../../../components/AnimatedDots";

/**
 * Overview tab content for ManageDocumentModal. Displays document metadata
 * and exposes a Delete Document action that opens the confirmation dialog.
 */
const OverviewTab = ({
    onClose,
    documentId,
}: {
    /** Called when the user dismisses the modal. */
    onClose: () => void;
    /** ID of the document being managed, passed to DeleteConfirmationModal. */
    documentId: string | undefined;
}) => {
    const {
        overview,
        documentAccess,
        isLoading,
        isDeleteDocumentConfirmOpen,
        setIsDeleteDocumentConfirmOpen,
    } = useOverviewTab({ documentId, onClose });
    const canDelete =
        documentAccess !== null && hasAccess(documentAccess, "admin"); // only admins and above may delete

    return (
        <>
            <div className="text-base sm:text-xl mb-4 sm:mb-6">Overview</div>
            {isLoading && (
                <p className="text-xs sm:text-sm text-text-secondary opacity-50">
                    Loading
                    <AnimatedDots />
                </p>
            )}
            <div className="flex flex-col space-y-3 sm:space-y-4">
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Title: </span>
                    <span
                        className={`text-text-secondary ${!overview?.title && "opacity-50"}`}
                    >
                        {overview?.title || "Untitled"}
                    </span>
                </div>
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Owner: </span>
                    <span className="text-text-secondary">
                        {overview
                            ? `${overview.ownerName} (${overview.ownerEmail})`
                            : "—"}
                    </span>
                </div>
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Creator: </span>
                    <span className="text-text-secondary">
                        {overview
                            ? `${overview.creatorName} (${overview.creatorEmail})`
                            : "—"}
                    </span>
                </div>
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Created on: </span>
                    <span className="text-text-secondary">
                        {overview ? formatDate(overview.createdAt) : "—"}
                    </span>
                </div>
            </div>
            {canDelete && (
                <button
                    onClick={() => setIsDeleteDocumentConfirmOpen(true)}
                    className="border-none bg-red-700 text-white w-[150px] text-xs sm:text-sm mt-8 sm:mt-10
                                                        text-center rounded-lg px-3 py-1 cursor-pointer hover:opacity-80 active:opacity-70 transition"
                >
                    Delete Document
                </button>
            )}
            {canDelete && isDeleteDocumentConfirmOpen && (
                <DeleteDocumentConfirmationModal
                    documentId={documentId}
                    onCancel={() => setIsDeleteDocumentConfirmOpen(false)}
                />
            )}
        </>
    );
};

export default OverviewTab;
