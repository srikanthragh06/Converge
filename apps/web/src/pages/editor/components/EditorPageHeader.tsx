import { useState } from "react";
import { useAtomValue } from "jotai";
import { syncStatusAtom } from "../../../atoms/socket";
import AnimatedDots from "../../../components/AnimatedDots";
import AvatarHeader from "./AvatarHeader";
import ManageDocumentModal from "./ManageDocumentModal";

/**
 * Top navigation bar for the editor page. Shows a sync/loading status
 * indicator on the right alongside the Manage Document button and AvatarHeader.
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

    // Resolve the status label and whether to show animated dots.
    const statusLabel =
        documentStatus === "loading"
            ? "Loading"
            : syncStatus === "offline"
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
                    {statusLabel && (
                        <span
                            className="text-text-secondary sm:text-sm text-xs opacity-40
                                        hidden sm:block"
                        >
                            {statusLabel}
                            {statusLabel !== null &&
                                statusLabel !== "Offline" && <AnimatedDots />}
                        </span>
                    )}
                    <button
                        onClick={() => setIsManageModalOpen(true)}
                        className="sm:px-3 sm:py-1 py-1 px-2 sm:text-sm text-xs rounded-md bg-background-overlay text-white
                        border-none
                        hover:opacity-90 active:opacity-80 transition cursor-pointer mb-1"
                    >
                        Manage Document
                    </button>

                    <AvatarHeader />
                </div>
            </div>

            {isManageModalOpen && (
                <ManageDocumentModal
                    onClose={() => setIsManageModalOpen(false)}
                    documentId={documentId}
                />
            )}
        </>
    );
};

export default EditorPageHeader;
