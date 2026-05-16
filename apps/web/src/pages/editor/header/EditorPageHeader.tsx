import { useState } from "react";
import { useAtomValue } from "jotai";
import { syncStatusAtom } from "../../../atoms/socket";
import AnimatedDots from "../../../components/AnimatedDots";
import ManageDocumentModal from "../manageDocumentModal/ManageDocumentModal";

/**
 * Top navigation bar for the editor page. Shows a sync status indicator on the
 * right alongside the Manage Document button. Only rendered when documentStatus
 * is "ready".
 */
const EditorPageHeader = ({
    documentStatus,
    documentId,
}: {
    documentStatus: "loading" | "ready" | "forbidden" | "notFound";
    /** ID of the currently open document, forwarded to ManageDocumentModal. */
    documentId: string | undefined;
}) => {
    const [isManageModalOpen, setIsManageModalOpen] = useState(false); // controls ManageDocumentModal visibility
    const syncStatus = useAtomValue(syncStatusAtom); // current sync state from useYjsSync

    // Resolve the sync status label shown in the header; null means no label.
    const statusLabel =
        syncStatus === "offline"
            ? "Offline"
            : syncStatus === "restoring"
              ? "Restoring"
              : syncStatus === "typing"
                ? "Typing"
                : syncStatus === "syncing"
                  ? "Syncing"
                  : null;

    return (
        <>
            <div className="sticky top-0 z-50 bg-background-base flex justify-end sm:px-8 px-2 py-2">
                <div className="flex items-center sm:space-x-8 sm:py-2 space-x-4">
                    {documentStatus === "ready" && statusLabel && (
                        <span
                            className="text-text-secondary sm:text-sm text-xs opacity-40
                                        hidden sm:block"
                        >
                            {statusLabel}
                            {statusLabel !== null &&
                                statusLabel !== "Offline" && <AnimatedDots />}
                        </span>
                    )}
                    {documentStatus === "ready" && (
                        <button
                            onClick={() => setIsManageModalOpen(true)}
                            className="sm:px-3 sm:py-1 py-1 px-2 sm:text-sm text-xs rounded-md bg-white text-black
                            border-none
                            hover:opacity-90 active:opacity-80 transition cursor-pointer mb-1"
                        >
                            Manage Document
                        </button>
                    )}
                </div>
            </div>

            {documentStatus === "ready" && isManageModalOpen && (
                <ManageDocumentModal
                    onClose={() => setIsManageModalOpen(false)}
                    documentId={documentId}
                />
            )}
        </>
    );
};

export default EditorPageHeader;
