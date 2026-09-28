import { useState } from "react";
import { useAtomValue } from "jotai";
import { syncStatusAtom, awarenessAtom } from "../../../atoms/socket";
import { authAtom } from "../../../atoms/auth";
import AnimatedDots from "../../../components/AnimatedDots";
import ManageDocumentModal from "../manageDocumentModal/ManageDocumentModal";
import CheckpointHistoryModal from "../checkpointHistoryModal/CheckpointHistoryModal";
import type { EditorInstance } from "../../../utils/checkpointDiffUtils";
import {
    MdOutlineWorkspaces,
    MdOutlineDescription,
    MdOutlineError,
    MdOutlineCheckCircle,
} from "react-icons/md";
import { FaHistory, FaRegSave, FaCog, FaLock, FaLockOpen } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Avatar, AvatarGroup } from "../../../components/ui/Avatar";
import Tooltip from "../../../components/ui/Tooltip";
import useCreateCheckpoint from "../../../hooks/useCreateCheckpoint";

/** Maximum number of avatars shown before collapsing the rest into a +N label. */
const MAX_VISIBLE_AVATARS = 4;

/**
 * Top navigation bar for the editor page. On the left shows a workspace › document
 * breadcrumb (desktop only). On the right shows a sync status indicator and the
 * Write Lock / Save Checkpoint / Checkpoint History / Document Settings icon
 * buttons. Only rendered when documentStatus is "ready".
 */
const EditorPageHeader = ({
    documentStatus,
    documentId,
    workspaceName,
    title,
    editor,
    isEditable,
    isWriteLocked,
    onToggleWriteLock,
}: {
    documentStatus: "loading" | "ready" | "forbidden" | "notFound";
    /** ID of the currently open document, forwarded to ManageDocumentModal. */
    documentId: string | undefined;
    /** Name of the workspace the document belongs to, shown as a breadcrumb label. */
    workspaceName: string | null;
    /** Title of the current document, shown as the second segment of the breadcrumb. */
    title: string;
    /** Live editor instance, forwarded to CheckpointHistoryModal for its live-document diff comparison. */
    editor: EditorInstance | null;
    /** Whether the requesting user has editor+ resolved access, forwarded to CheckpointHistoryModal to gate the restore action. */
    isEditable: boolean;
    /** Whether this user has locally locked writes on this document, for the write lock button's icon/tooltip. */
    isWriteLocked: boolean;
    /** Flips the local write lock for this document. */
    onToggleWriteLock: () => void;
}) => {
    const [isManageModalOpen, setIsManageModalOpen] = useState(false); // controls ManageDocumentModal visibility
    const [isCheckpointHistoryModalOpen, setIsCheckpointHistoryModalOpen] =
        useState(false); // controls CheckpointHistoryModal visibility
    const { createCheckpoint, status: createCheckpointStatus } =
        useCreateCheckpoint(documentId); // manual "save checkpoint" request + its idle/loading/success/error status
    const syncStatus = useAtomValue(syncStatusAtom); // current sync state from useYjsSync
    const awareness = useAtomValue(awarenessAtom); // presence list for the current document
    const auth = useAtomValue(authAtom); // current user — used to exclude self from the avatar stack

    // Filter out the current user so they don't see their own avatar in the stack.
    const otherUsers = awareness.filter(
        (u) => u.userId !== Number(auth.user?.id),
    );
    const visibleUsers = otherUsers.slice(0, MAX_VISIBLE_AVATARS); // avatars rendered explicitly
    const overflowCount = otherUsers.length - visibleUsers.length; // users collapsed into +N label

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
            <div className="sticky top-0 z-50 bg-surface flex justify-between items-center gap-4 sm:px-8 px-2 py-2">
                {/* Workspace › document breadcrumb — flex-1 min-w-0 so this segment shrinks
                    before the avatar/status/button group on the right. Workspace name and
                    title are each their own truncate min-w-0 span (not flex containers) so
                    they ellipsis independently instead of overflowing the header. */}
                {workspaceName && (
                    <span className="hidden sm:flex items-center gap-1.5 text-fg sm:text-sm opacity-90 min-w-0 flex-1">
                        <MdOutlineWorkspaces className="shrink-0 opacity-60" />
                        <span className="truncate min-w-0">
                            {workspaceName}
                        </span>
                        <span className="shrink-0 opacity-60">›</span>
                        <MdOutlineDescription className="shrink-0 opacity-60" />
                        <span
                            className={`truncate min-w-0 ${title.length === 0 ? "opacity-50" : ""}`}
                        >
                            {title || "Untitled"}
                        </span>
                    </span>
                )}
                {/* Right-hand controls: presence avatars, sync status, and the icon
                    action buttons. No shrink/truncate classes here — this group always
                    renders at full size, and the breadcrumb on the left gives way instead. */}
                <div className="flex items-center sm:space-x-8 space-x-4 ml-auto">
                    {/* Presence avatars — one tooltip + avatar per online collaborator
                        (self excluded), collapsing anything past MAX_VISIBLE_AVATARS into
                        a +N badge. */}
                    {documentStatus === "ready" && otherUsers.length > 0 && (
                        <AvatarGroup>
                            {visibleUsers.map((user) => (
                                <Tooltip
                                    key={user.userId}
                                    content={
                                        <>
                                            <p className="font-medium text-sm">
                                                {user.name}
                                            </p>
                                            <p className="opacity-70">
                                                {user.email}
                                            </p>
                                            <p className="opacity-50 capitalize mt-0.5">
                                                {user.accessLevel}
                                            </p>
                                        </>
                                    }
                                >
                                    <Avatar
                                        name={user.name}
                                        src={user.avatarUrl}
                                        ringColor={user.color}
                                        className="sm:w-8 sm:h-8 sm:text-sm"
                                    />
                                </Tooltip>
                            ))}
                            {overflowCount > 0 && (
                                <Avatar
                                    name={`${overflowCount} more`}
                                    label={`+${overflowCount}`}
                                    className="sm:w-8 sm:h-8"
                                />
                            )}
                        </AvatarGroup>
                    )}
                    {documentStatus === "ready" && statusLabel && (
                        <span
                            className="text-fg-secondary sm:text-sm text-xs opacity-40
                                        hidden sm:block"
                        >
                            {statusLabel}
                            {statusLabel !== null &&
                                statusLabel !== "Offline" && <AnimatedDots />}
                        </span>
                    )}
                    {/* Icon action group — Write Lock, Save Checkpoint, Checkpoint History, and
                        Document Settings share a tighter gap than the sm:space-x-8 used to
                        separate this whole group from the avatars/status label on its left. */}
                    <div className="flex items-center space-x-3 sm:space-x-6">
                        {/* Write Lock button — a local, per-user comfort toggle that disables
                            editing in this browser only. Has no effect on this user's actual
                            access level or on any other user's ability to write. Shown to
                            editor+ users only, since locking is meaningless without write access. */}
                        {documentStatus === "ready" && isEditable && (
                            <Tooltip
                                content={
                                    isWriteLocked
                                        ? "Unlock Writes"
                                        : "Lock Writes"
                                }
                            >
                                <button
                                    onClick={onToggleWriteLock}
                                    aria-pressed={isWriteLocked}
                                    className={`transition cursor-pointer border-none bg-transparent text-fg ${
                                        isWriteLocked
                                            ? "opacity-100"
                                            : "opacity-70 hover:opacity-100"
                                    }`}
                                >
                                    {isWriteLocked ? (
                                        <FaLock className="sm:w-4 sm:h-4 w-4 h-4" />
                                    ) : (
                                        <FaLockOpen className="sm:w-4 sm:h-4 w-4 h-4" />
                                    )}
                                </button>
                            </Tooltip>
                        )}

                        {/* Create Checkpoint button — takes a manual version-history checkpoint.
                            Editor+ only, since the endpoint requires the same access level;
                            hidden for viewers rather than left to fail with a 403 on click.
                            Icon reflects the request's status: save icon while idle, a spinner
                            while in flight, then a checkmark or error icon for 2s depending on
                            the outcome before reverting to idle. */}
                        {documentStatus === "ready" && isEditable && (
                            <Tooltip content="Save Checkpoint">
                                <button
                                    onClick={createCheckpoint}
                                    disabled={createCheckpointStatus !== "idle"}
                                    className="text-fg opacity-70 hover:opacity-100 transition cursor-pointer border-none bg-transparent disabled:cursor-default disabled:hover:opacity-70"
                                >
                                    {createCheckpointStatus === "loading" ? (
                                        <AiOutlineLoading3Quarters className="sm:w-4 sm:h-4 w-4 h-4 animate-spin" />
                                    ) : createCheckpointStatus === "success" ? (
                                        <MdOutlineCheckCircle className="sm:w-4 sm:h-4 w-4 h-4" />
                                    ) : createCheckpointStatus === "error" ? (
                                        <MdOutlineError className="sm:w-4 sm:h-4 w-4 h-4" />
                                    ) : (
                                        <FaRegSave className="sm:w-4 sm:h-4 w-4 h-4" />
                                    )}
                                </button>
                            </Tooltip>
                        )}

                        {/* Checkpoint History button — opens CheckpointHistoryModal. */}
                        {documentStatus === "ready" && (
                            <Tooltip content="Checkpoint History">
                                <button
                                    onClick={() =>
                                        setIsCheckpointHistoryModalOpen(true)
                                    }
                                    className="text-fg opacity-70 hover:opacity-100 transition cursor-pointer border-none bg-transparent"
                                >
                                    <FaHistory className="sm:w-4 sm:h-4 w-4 h-4" />
                                </button>
                            </Tooltip>
                        )}
                        {/* Document Settings button — opens ManageDocumentModal. */}
                        {documentStatus === "ready" && (
                            <Tooltip content="Document Settings">
                                <button
                                    onClick={() => setIsManageModalOpen(true)}
                                    className="text-fg opacity-70 hover:opacity-100 transition cursor-pointer border-none bg-transparent"
                                >
                                    <FaCog className="sm:w-4 sm:h-4 w-4 h-4" />
                                </button>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>

            {/* Manage Document modal — mounted only while open. */}
            {documentStatus === "ready" && isManageModalOpen && (
                <ManageDocumentModal
                    onClose={() => setIsManageModalOpen(false)}
                    documentId={documentId}
                />
            )}

            {/* Checkpoint History modal — mounted only while open. */}
            {documentStatus === "ready" && isCheckpointHistoryModalOpen && (
                <CheckpointHistoryModal
                    documentId={documentId}
                    editor={editor}
                    isEditable={isEditable}
                    onClose={() => setIsCheckpointHistoryModalOpen(false)}
                />
            )}
        </>
    );
};

export default EditorPageHeader;
