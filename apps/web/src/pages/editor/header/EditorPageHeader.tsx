import { useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
    LuBookmarkPlus,
    LuCheck,
    LuCircleAlert,
    LuClock,
    LuEllipsis,
    LuLoaderCircle,
    LuLock,
    LuLockOpen,
    LuMenu,
    LuUsers,
} from "react-icons/lu";
import { syncStatusAtom, awarenessAtom } from "../../../atoms/socket";
import { authAtom } from "../../../atoms/auth";
import { mobileSidebarOpenAtom } from "../../../atoms/sidebar";
import ManageDocumentModal from "../manageDocumentModal/ManageDocumentModal";
import CheckpointHistoryModal from "../checkpointHistoryModal/CheckpointHistoryModal";
import type { EditorInstance } from "../../../utils/checkpointDiffUtils";
import type { ManageDocumentTab } from "../../../hooks/useManageDocumentModal";
import { Avatar, AvatarGroup } from "../../../components/ui/Avatar";
import { StatusDot } from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import Tooltip from "../../../components/ui/Tooltip";
import { DropdownMenu } from "../../../components/ui/Menu";
import useCreateCheckpoint from "../../../hooks/useCreateCheckpoint";
import useDocumentMenuActions from "../../../hooks/useDocumentMenuActions";
import { getSyncStatusDisplay } from "./syncStatusDisplay";
import { getEditorDocumentMenu } from "./editorDocumentMenu";

/** Maximum number of avatars shown before collapsing the rest into a +N label. */
const MAX_VISIBLE_AVATARS = 4;

/**
 * Top bar of the editor page. On desktop: a workspace / document breadcrumb
 * with the Saved / Syncing / Offline status dot on the left; collaborators'
 * presence avatars, the lock-editing, save-checkpoint, and version-history
 * icon buttons, the gold Share button, and the ⋯ document menu on the right.
 * On phones: a compact bar with the sidebar drawer button, the document title
 * and status dot, a Share icon, and the ⋯ menu. Only rendered when
 * documentStatus is "ready".
 */
const EditorPageHeader = ({
    documentStatus,
    documentId,
    workspaceName,
    title,
    editor,
    isEditable,
    isPinned,
    canTrash,
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
    /** Whether the user has pinned the document to the sidebar, for the ⋯ menu's Pin / Unpin entry. */
    isPinned: boolean;
    /** Whether the user may move the document to Trash (admin access). */
    canTrash: boolean;
    /** Whether this user has locally locked writes on this document, for the lock button's icon/tooltip. */
    isWriteLocked: boolean;
    /** Flips the local write lock for this document. */
    onToggleWriteLock: () => void;
}) => {
    const [manageModalTab, setManageModalTab] =
        useState<ManageDocumentTab | null>(null); // tab ManageDocumentModal opens on; null while it's closed
    const [isCheckpointHistoryModalOpen, setIsCheckpointHistoryModalOpen] =
        useState(false); // controls CheckpointHistoryModal visibility
    const { createCheckpoint, status: createCheckpointStatus } =
        useCreateCheckpoint(documentId); // manual "save checkpoint" request + its idle/loading/success/error status
    const syncStatus = useAtomValue(syncStatusAtom); // current sync state from useYjsSync
    const awareness = useAtomValue(awarenessAtom); // presence list for the current document
    const auth = useAtomValue(authAtom); // current user — used to exclude self from the avatar stack
    const { togglePin, copyLink, moveToTrash } = useDocumentMenuActions(); // ⋯ menu actions, shared with the sidebar's row menu
    const setIsDrawerOpen = useSetAtom(mobileSidebarOpenAtom); // opens the sidebar drawer from the phone bar

    // Filter out the current user so they don't see their own avatar in the stack.
    const otherUsers = awareness.filter(
        (u) => u.userId !== Number(auth.user?.id),
    );
    const visibleUsers = otherUsers.slice(0, MAX_VISIBLE_AVATARS); // avatars rendered explicitly
    const overflowCount = otherUsers.length - visibleUsers.length; // users collapsed into +N label
    const status = getSyncStatusDisplay(syncStatus); // dot tone + label beside the breadcrumb
    const menuDocument = { id: Number(documentId), title }; // the open document, as the menu actions take it
    const documentMenu = getEditorDocumentMenu({
        isPinned,
        canTrash,
        onTogglePin: () => togglePin(menuDocument.id, !isPinned),
        onCopyLink: () => copyLink(menuDocument),
        onOpenDetails: () => setManageModalTab("overview"),
        onMoveToTrash: () => moveToTrash(menuDocument),
    }); // entries of the ⋯ menu

    /**
     * The ⋯ button and its dropdown of documentMenu.
     * @param className - extra trigger classes
     */
    const renderDocumentMenu = (className?: string) => (
        <DropdownMenu
            items={documentMenu}
            className="w-60"
            trigger={
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Document menu"
                    className={`data-[state=open]:bg-surface-selected data-[state=open]:text-fg ${className ?? ""}`}
                >
                    <LuEllipsis />
                </Button>
            }
        />
    );

    if (documentStatus !== "ready") return null;

    return (
        <>
            {/* Phone bar (pp 77 / 83) — Page's generic bar is turned off for the editor */}
            <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line-subtle bg-surface px-2 sm:hidden">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDrawerOpen(true)}
                    aria-label="Open sidebar"
                    className="[&_svg]:h-5 [&_svg]:w-5"
                >
                    <LuMenu />
                </Button>
                <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
                    <span
                        className={`truncate text-[15px] font-semibold ${title ? "text-fg" : "text-fg-muted"}`}
                    >
                        {title || "Untitled"}
                    </span>
                    <StatusDot
                        tone={status.tone}
                        aria-label={status.label}
                        title={status.label}
                        className="shrink-0"
                    />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setManageModalTab("access-overrides")}
                    aria-label="Share"
                    className="text-gold hover:text-gold [&_svg]:h-5 [&_svg]:w-5"
                >
                    <LuUsers />
                </Button>
                {renderDocumentMenu()}
            </header>

            {/* Desktop bar */}
            <header className="hidden h-[60px] shrink-0 items-center gap-4 border-b border-line-subtle bg-surface pl-7 pr-4 sm:flex">
                {/* Workspace / document breadcrumb and status — min-w-0 so the
                    names truncate before the buttons on the right shrink. */}
                <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
                    {workspaceName && (
                        <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-fg-muted">
                                {workspaceName}
                            </span>
                            <span className="shrink-0 text-fg-muted">/</span>
                            <span
                                className={`truncate font-medium ${title ? "text-fg" : "text-fg-muted"}`}
                            >
                                {title || "Untitled"}
                            </span>
                        </span>
                    )}
                    <StatusDot
                        tone={status.tone}
                        label={status.label}
                        className="ml-3 shrink-0"
                    />
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    {/* Presence avatars — one per online collaborator (self
                        excluded), anything past MAX_VISIBLE_AVATARS collapsed into +N.
                        Each keeps its presence color as a ring, matching the
                        collaborator's block highlight in the document. */}
                    {otherUsers.length > 0 && (
                        <AvatarGroup className="mr-2">
                            {visibleUsers.map((user) => (
                                <Tooltip
                                    key={user.userId}
                                    content={
                                        <>
                                            <p className="text-sm font-medium">
                                                {user.name}
                                            </p>
                                            <p className="opacity-70">
                                                {user.email}
                                            </p>
                                            <p className="mt-0.5 capitalize opacity-50">
                                                {user.accessLevel}
                                            </p>
                                        </>
                                    }
                                >
                                    <Avatar
                                        name={user.name}
                                        src={user.avatarUrl}
                                        colorKey={String(user.userId)}
                                        ringColor={user.color}
                                        className="h-8 w-8 text-xs font-semibold"
                                    />
                                </Tooltip>
                            ))}
                            {overflowCount > 0 && (
                                <Avatar
                                    name={`${overflowCount} more`}
                                    label={`+${overflowCount}`}
                                    className="h-8 w-8 text-xs"
                                />
                            )}
                        </AvatarGroup>
                    )}

                    {/* Lock editing — a local, per-user comfort toggle that disables
                        editing in this browser only. Has no effect on this user's
                        actual access level or anyone else's. Editor+ only, since
                        locking is meaningless without write access. */}
                    {isEditable && (
                        <Tooltip
                            content={
                                isWriteLocked
                                    ? "Unlock editing"
                                    : "Lock editing"
                            }
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                pressed={isWriteLocked}
                                onClick={onToggleWriteLock}
                                aria-label={
                                    isWriteLocked
                                        ? "Unlock editing"
                                        : "Lock editing"
                                }
                                className={
                                    isWriteLocked
                                        ? "text-gold hover:text-gold"
                                        : ""
                                }
                            >
                                {isWriteLocked ? <LuLock /> : <LuLockOpen />}
                            </Button>
                        </Tooltip>
                    )}

                    {/* Save checkpoint — takes a manual version-history checkpoint.
                        Editor+ only, since the endpoint requires the same access
                        level; hidden for viewers rather than left to fail with a 403.
                        The icon shows the request's status: a spinner while in
                        flight, then a check or alert for 2s before reverting. */}
                    {isEditable && (
                        <Tooltip content="Save checkpoint">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={createCheckpoint}
                                disabled={createCheckpointStatus !== "idle"}
                                aria-label="Save checkpoint"
                                className="disabled:opacity-100"
                            >
                                {createCheckpointStatus === "loading" ? (
                                    <LuLoaderCircle className="animate-spin" />
                                ) : createCheckpointStatus === "success" ? (
                                    <LuCheck className="text-success" />
                                ) : createCheckpointStatus === "error" ? (
                                    <LuCircleAlert className="text-danger" />
                                ) : (
                                    <LuBookmarkPlus />
                                )}
                            </Button>
                        </Tooltip>
                    )}

                    {/* Version history — opens CheckpointHistoryModal. */}
                    <Tooltip content="Version history">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                                setIsCheckpointHistoryModalOpen(true)
                            }
                            aria-label="Version history"
                        >
                            <LuClock />
                        </Button>
                    </Tooltip>

                    <div className="mx-2 h-5 w-px bg-line" />

                    {/* Share — opens the access settings until the Share dialog
                        replaces ManageDocumentModal (redesign 5.1). */}
                    <Button
                        variant="primary"
                        onClick={() => setManageModalTab("access-overrides")}
                        className="px-4 font-semibold"
                    >
                        <LuUsers />
                        Share
                    </Button>

                    {/* ⋯ — pin, copy link, document details, move to Trash */}
                    {renderDocumentMenu("ml-1")}
                </div>
            </header>

            {/* Manage Document modal — mounted only while open. */}
            {manageModalTab && (
                <ManageDocumentModal
                    onClose={() => setManageModalTab(null)}
                    documentId={documentId}
                    initialTab={manageModalTab}
                />
            )}

            {/* Checkpoint History modal — mounted only while open. */}
            {isCheckpointHistoryModalOpen && (
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
