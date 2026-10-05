import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import {
    LuCheck,
    LuCircleAlert,
    LuClock,
    LuCopy,
    LuEllipsis,
    LuLoaderCircle,
    LuLock,
    LuLockOpen,
    LuMenu,
    LuUsers,
} from "react-icons/lu";
import { FaRegSave } from "react-icons/fa";
import { syncStatusAtom, awarenessAtom } from "@/atoms/socket";
import { authAtom } from "@/atoms/auth";
import { mobileSidebarOpenAtom } from "@/atoms/sidebar";
import CheckpointHistoryModal from "@/features/editor/checkpointHistoryModal/CheckpointHistoryModal";
import type { EditorInstance } from "@/features/editor/lib/checkpointDiffUtils";
import { Avatar, AvatarGroup } from "@/components/common/Avatar";
import { Badge, StatusDot } from "@/components/ui/Badge";
import { formatAccessLevel } from "@/lib/utils";
import type { ResolvedDocumentAccessLevel } from "@converge/shared";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import { DropdownMenu, type MenuEntry } from "@/components/ui/Menu";
import BottomSheet, { SheetMenu } from "@/components/ui/BottomSheet";
import useCreateCheckpoint from "@/features/editor/hooks/useCreateCheckpoint";
import useDocumentMenuActions from "@/features/documents/hooks/useDocumentMenuActions";
import useToast from "@/hooks/useToast";
import { copyDocumentMarkdown } from "@/features/editor/lib/copyDocumentMarkdown";
import { getSyncStatusDisplay } from "./syncStatusDisplay";
import { getEditorDocumentMenu } from "./editorDocumentMenu";

/** What each access level lets the user do, shown on the access badge's hover. */
const ACCESS_DESCRIPTIONS: Record<ResolvedDocumentAccessLevel, string> = {
    owner: "You own this workspace — full access",
    admin: "You can edit and manage who has access",
    editor: "You can edit this document",
    viewer: "You can read but not edit this document",
    noAccess: "You don't have access to this document",
};

/** Maximum number of avatars shown before collapsing the rest into a +N label. */
const MAX_VISIBLE_AVATARS = 4;

/**
 * Top bar of the editor page. On desktop: a workspace / document breadcrumb
 * with the user's access level badge and the Saved / Syncing / Offline status
 * dot on the left; collaborators'
 * presence avatars, the copy-as-Markdown, lock-editing, save-checkpoint, and
 * version-history icon buttons, the gold Share button, and the ⋯ document menu on the right.
 * On phones: a compact bar with the sidebar drawer button, the document title,
 * access badge and status dot, a Share icon, and a ⋯ button opening a bottom sheet that
 * also holds the lock / checkpoint / history actions. Only rendered when
 * documentStatus is "ready".
 */
const EditorPageHeader = ({
    documentStatus,
    documentId,
    workspaceName,
    title,
    editor,
    isEditable,
    accessLevel,
    isPinned,
    canTrash,
    isWriteLocked,
    onToggleWriteLock,
}: {
    documentStatus: "loading" | "ready" | "forbidden" | "notFound";
    /** ID of the currently open document, forwarded to the Share, Document details, and version-history modals. */
    documentId: number;
    /** Name of the workspace the document belongs to, shown as a breadcrumb label. */
    workspaceName: string | null;
    /** Title of the current document, shown as the second segment of the breadcrumb. */
    title: string;
    /** Live editor instance, forwarded to CheckpointHistoryModal for its live-document diff comparison. */
    editor: EditorInstance | null;
    /** Whether the requesting user has editor+ resolved access, forwarded to CheckpointHistoryModal to gate the restore action. */
    isEditable: boolean;
    /** The user's resolved access to the document, shown as a badge beside the title; null while unknown. */
    accessLevel: ResolvedDocumentAccessLevel | null;
    /** Whether the user has pinned the document to the sidebar, for the ⋯ menu's Pin / Unpin entry. */
    isPinned: boolean;
    /** Whether the user may move the document to Trash (admin access). */
    canTrash: boolean;
    /** Whether this user has locally locked writes on this document, for the lock button's icon/tooltip. */
    isWriteLocked: boolean;
    /** Flips the local write lock for this document. */
    onToggleWriteLock: () => void;
}) => {
    const [isCheckpointHistoryModalOpen, setIsCheckpointHistoryModalOpen] =
        useState(false); // controls CheckpointHistoryModal visibility
    const [isSheetOpen, setIsSheetOpen] = useState(false); // phones: whether the ⋯ document sheet is open
    const location = useLocation();
    const navigate = useNavigate();
    const [handledHistoryKey, setHandledHistoryKey] = useState<string | null>(
        null,
    ); // location key whose openVersionHistory request was already acted on

    // A sidebar row's Version history navigates here with openVersionHistory
    // in the router state (see useDocumentMenuActions). Opened during render,
    // React's pattern for adjusting state when a prop changes, once per
    // navigation.
    const wantsVersionHistory =
        (location.state as { openVersionHistory?: boolean } | null)
            ?.openVersionHistory === true;
    if (wantsVersionHistory && location.key !== handledHistoryKey) {
        setHandledHistoryKey(location.key);
        setIsCheckpointHistoryModalOpen(true);
    }

    // Drops the request from the history entry once acted on, so a reload or
    // Back doesn't reopen Version history.
    useEffect(() => {
        if (wantsVersionHistory)
            navigate(location.pathname, { replace: true, state: null });
    }, [wantsVersionHistory, navigate, location.pathname]);
    const { createCheckpoint, status: createCheckpointStatus } =
        useCreateCheckpoint(documentId); // manual "save checkpoint" request + its idle/loading/success/error status
    const syncStatus = useAtomValue(syncStatusAtom); // current sync state from useYjsSync
    const awareness = useAtomValue(awarenessAtom); // presence list for the current document
    const auth = useAtomValue(authAtom); // current user — used to exclude self from the avatar stack
    const { togglePin, copyLink, openShare, openDetails, moveToTrash } =
        useDocumentMenuActions(); // ⋯ menu actions, shared with the sidebar's row menu
    const setIsDrawerOpen = useSetAtom(mobileSidebarOpenAtom); // opens the sidebar drawer from the phone bar
    const { showToast } = useToast(); // reports the sheet's Save checkpoint result, since the sheet closes on tap

    // Filter out the current user so they don't see their own avatar in the stack.
    const otherUsers = awareness.filter(
        (u) => u.userId !== Number(auth.user?.id),
    );
    const visibleUsers = otherUsers.slice(0, MAX_VISIBLE_AVATARS); // avatars rendered explicitly
    const overflowCount = otherUsers.length - visibleUsers.length; // users collapsed into +N label
    const status = getSyncStatusDisplay(syncStatus); // dot tone + label beside the breadcrumb
    const menuDocument = { id: documentId, title }; // the open document, as the menu actions take it
    const documentMenu = getEditorDocumentMenu({
        isPinned,
        canTrash,
        onTogglePin: () => togglePin(menuDocument, !isPinned),
        onCopyLink: () => copyLink(menuDocument),
        onOpenDetails: () => openDetails(menuDocument),
        onMoveToTrash: () => moveToTrash(menuDocument),
    }); // entries of the ⋯ menu

    /**
     * Saves a checkpoint from the phone sheet and reports the outcome with a
     * toast — the sheet has closed, so the desktop button's status icon
     * isn't there to show it. A failure toasts globally.
     */
    const saveCheckpointFromSheet = () =>
        createCheckpoint((result) =>
            showToast(
                result.created
                    ? "Checkpoint saved"
                    : "No changes since the last checkpoint",
            ),
        );

    // Phone sheet (pp 79 / 85): the header's icon-button actions, then the ⋯ menu.
    // Lock and checkpoint are editor+ only, as in the desktop bar.
    const sheetMenu: MenuEntry[] = [
        {
            label: "Copy as Markdown",
            icon: <LuCopy />,
            disabled: !editor,
            onSelect: () => editor && copyDocumentMarkdown(editor, title),
        },
        ...(isEditable
            ? ([
                  {
                      label: isWriteLocked ? "Unlock editing" : "Lock editing",
                      description: isWriteLocked
                          ? "Allows edits on this device again"
                          : "Stops accidental edits on this device",
                      icon: isWriteLocked ? <LuLock /> : <LuLockOpen />,
                      onSelect: onToggleWriteLock,
                  },
                  {
                      label: "Save checkpoint",
                      icon: <FaRegSave />,
                      disabled: createCheckpointStatus !== "idle",
                      onSelect: saveCheckpointFromSheet,
                  },
              ] satisfies MenuEntry[])
            : []),
        {
            label: "Version history",
            icon: <LuClock />,
            onSelect: () => setIsCheckpointHistoryModalOpen(true),
        },
        { type: "separator" },
        ...documentMenu,
    ];

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
                    {accessLevel && (
                        <Badge variant="outline">
                            {formatAccessLevel(accessLevel)}
                        </Badge>
                    )}
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
                    onClick={() => openShare(menuDocument)}
                    aria-label="Share"
                    className="text-gold hover:text-gold [&_svg]:h-5 [&_svg]:w-5"
                >
                    <LuUsers />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSheetOpen(true)}
                    aria-label="Document menu"
                >
                    <LuEllipsis />
                </Button>
            </header>

            {/* Desktop bar */}
            <header className="hidden h-[60px] shrink-0 items-center gap-4 border-b border-line-subtle bg-surface pl-7 pr-4 sm:flex">
                {/* Workspace / document breadcrumb and status — min-w-0 so the
                    names truncate before the buttons on the right shrink. */}
                <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
                    {workspaceName && (
                        <span className="flex min-w-0 items-center gap-2">
                            <Tooltip content={workspaceName}>
                                <span className="truncate text-fg-muted">
                                    {workspaceName}
                                </span>
                            </Tooltip>
                            <span className="shrink-0 text-fg-muted">/</span>
                            <Tooltip content={title || "Untitled"}>
                                <span
                                    className={`truncate font-medium ${title ? "text-fg" : "text-fg-muted"}`}
                                >
                                    {title || "Untitled"}
                                </span>
                            </Tooltip>
                        </span>
                    )}
                    {accessLevel && (
                        <Tooltip content={ACCESS_DESCRIPTIONS[accessLevel]}>
                            <Badge variant="outline" className="ml-1">
                                {formatAccessLevel(accessLevel)}
                            </Badge>
                        </Tooltip>
                    )}
                    <StatusDot
                        tone={status.tone}
                        label={status.label}
                        className="ml-2 shrink-0"
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

                    {/* Copy as Markdown — shown to viewers too, since it only reads. */}
                    <Tooltip content="Copy as Markdown">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                                editor && copyDocumentMarkdown(editor, title)
                            }
                            disabled={!editor}
                            aria-label="Copy as Markdown"
                        >
                            <LuCopy />
                        </Button>
                    </Tooltip>

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
                                onClick={() => createCheckpoint()}
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
                                    <FaRegSave />
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

                    {/* Share — opens the Share dialog */}
                    <Button
                        variant="primary"
                        onClick={() => openShare(menuDocument)}
                        className="px-4 font-semibold"
                    >
                        <LuUsers />
                        Share
                    </Button>

                    {/* ⋯ — pin, copy link, document details, move to Trash */}
                    <DropdownMenu
                        items={documentMenu}
                        className="w-60"
                        tooltip="More actions"
                        trigger={
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Document menu"
                                className="ml-1 data-[state=open]:bg-surface-selected data-[state=open]:text-fg"
                            >
                                <LuEllipsis />
                            </Button>
                        }
                    />
                </div>
            </header>

            {/* Phone document sheet */}
            <BottomSheet
                open={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                title={title || "Untitled"}
            >
                <SheetMenu
                    items={sheetMenu}
                    onClose={() => setIsSheetOpen(false)}
                />
            </BottomSheet>

            {/* Checkpoint History modal — mounted only while open. */}
            {isCheckpointHistoryModalOpen && (
                <CheckpointHistoryModal
                    documentId={documentId}
                    documentTitle={title}
                    editor={editor}
                    isEditable={isEditable}
                    onClose={() => setIsCheckpointHistoryModalOpen(false)}
                />
            )}
        </>
    );
};

export default EditorPageHeader;
