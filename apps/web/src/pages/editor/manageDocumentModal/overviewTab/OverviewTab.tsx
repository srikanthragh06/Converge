import type { DocumentIndexingStatus } from "@converge/shared";
import { formatDate, timeAgo, hasAccess } from "../../../../utils/utils";
import DeleteDocumentConfirmationModal from "./DeleteDocumentConfirmationModal";
import useOverviewTab from "../../../../hooks/useOverviewTab";
import { Skeleton } from "primereact/skeleton";
import DelayedRender from "../../../../components/DelayedRender";

/** Friendly label for each RAG indexing lifecycle state. */
const indexingStatusLabel: Record<DocumentIndexingStatus, string> = {
    idle: "Up to date",
    pending: "Pending",
    indexing: "Indexing…",
};

/**
 * Overview tab content for ManageDocumentModal. Displays document metadata
 * (including RAG indexing status, which useOverviewTab polls so it resolves
 * live from pending/indexing to idle without a manual refresh) and exposes a
 * Delete Document action that opens the confirmation dialog.
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

    // Skeleton placeholder shown while the overview/access fetches are in flight.
    if (isLoading)
        return (
            <DelayedRender>
                <div className="flex flex-col gap-3">
                    <Skeleton height="1rem" width="55%" />
                    <Skeleton height="1rem" width="70%" />
                    <Skeleton height="1rem" width="65%" />
                    <Skeleton height="1rem" width="50%" />
                </div>
            </DelayedRender>
        );

    return (
        <>
            {/* Document metadata rows */}
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
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Search indexing: </span>
                    <span className="text-text-secondary">
                        {overview
                            ? indexingStatusLabel[overview.indexingStatus]
                            : "—"}
                    </span>
                </div>
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Last indexed: </span>
                    <span className="text-text-secondary">
                        {overview
                            ? overview.lastIndexedAt
                                ? timeAgo(overview.lastIndexedAt)
                                : "Never"
                            : "—"}
                    </span>
                </div>
            </div>
            {/* Admin-only delete action, plus its confirmation dialog */}
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
