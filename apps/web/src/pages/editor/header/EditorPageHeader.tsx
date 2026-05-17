import { useState } from "react";
import { useAtomValue } from "jotai";
import { syncStatusAtom } from "../../../atoms/socket";
import AnimatedDots from "../../../components/AnimatedDots";
import ManageDocumentModal from "../manageDocumentModal/ManageDocumentModal";
import { MdOutlineWorkspaces, MdOutlineDescription } from "react-icons/md";

/**
 * Top navigation bar for the editor page. On the left shows a workspace › document
 * breadcrumb (desktop only). On the right shows a sync status indicator and the
 * Manage Document button. Only rendered when documentStatus is "ready".
 */
const EditorPageHeader = ({
    documentStatus,
    documentId,
    workspaceName,
    title,
}: {
    documentStatus: "loading" | "ready" | "forbidden" | "notFound";
    /** ID of the currently open document, forwarded to ManageDocumentModal. */
    documentId: string | undefined;
    /** Name of the workspace the document belongs to, shown as a breadcrumb label. */
    workspaceName: string | null;
    /** Title of the current document, shown as the second segment of the breadcrumb. */
    title: string;
}) => {
    const [isManageModalOpen, setIsManageModalOpen] = useState(false); // controls ManageDocumentModal visibility
    const syncStatus = useAtomValue(syncStatusAtom); // current sync state from useYjsSync

    // Resolve the sync status label shown in the header; null means no label.
    const statusLabel =
        syncStatus === "offline"
            ? "Offline"
            : syncStatus === "restoring"
              ? "Loading"
              : syncStatus === "typing"
                ? "Typing"
                : syncStatus === "syncing"
                  ? "Syncing"
                  : null;

    return (
        <>
            <div className="sticky top-0 z-50 bg-background-base flex justify-between items-center sm:px-8 px-2 py-2">
                {workspaceName && (
                    <span className="hidden sm:flex items-center gap-1.5 text-white sm:text-sm opacity-90 truncate min-w-0">
                        <MdOutlineWorkspaces className="shrink-0 opacity-60" />
                        <span className="truncate flex items-center gap-1.5">
                            {workspaceName}
                            <span className="opacity-60">›</span>
                            <MdOutlineDescription className="shrink-0 opacity-60" />
                            <span
                                className={`${title.length === 0 ? "opacity-50" : ""}`}
                            >
                                {title || "Untitled"}
                            </span>
                        </span>
                    </span>
                )}
                <div className="flex items-center sm:space-x-8 sm:py-2 space-x-4 ml-auto">
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
                            className="sm:px-2 sm:py-1 py-1 px-2 sm:text-sm text-xs rounded-md bg-white text-black
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
