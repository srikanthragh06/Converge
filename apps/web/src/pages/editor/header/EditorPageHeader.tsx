import { useState } from "react";
import { useAtomValue } from "jotai";
import { syncStatusAtom, awarenessAtom } from "../../../atoms/socket";
import { authAtom } from "../../../atoms/auth";
import AnimatedDots from "../../../components/AnimatedDots";
import ManageDocumentModal from "../manageDocumentModal/ManageDocumentModal";
import { MdOutlineWorkspaces, MdOutlineDescription } from "react-icons/md";
import { Avatar } from "primereact/avatar";
import { AvatarGroup } from "primereact/avatargroup";
import { Tooltip } from "primereact/tooltip";
import "primereact/resources/themes/lara-dark-blue/theme.css";

/** Maximum number of avatars shown before collapsing the rest into a +N label. */
const MAX_VISIBLE_AVATARS = 4;

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
                <div className="flex items-center sm:space-x-8 py-1 space-x-4 ml-auto">
                    {documentStatus === "ready" && otherUsers.length > 0 && (
                        <>
                            {visibleUsers.map((user) => (
                                <Tooltip
                                    key={user.userId}
                                    target={`#awareness-avatar-${user.userId}`}
                                    position="bottom"
                                    pt={{
                                        text: {
                                            style: {
                                                backgroundColor: "#171717",
                                                color: "white",
                                                border: "1px solid #333",
                                            },
                                        },
                                        arrow: {
                                            style: {
                                                borderBottomColor: "#171717",
                                            },
                                        },
                                    }}
                                >
                                    <p className="font-medium text-sm">
                                        {user.name}
                                    </p>
                                    <p className="text-xs opacity-60">
                                        {user.email}
                                    </p>
                                </Tooltip>
                            ))}
                            <AvatarGroup>
                                {visibleUsers.map((user) => (
                                    <Avatar
                                        key={user.userId}
                                        id={`awareness-avatar-${user.userId}`}
                                        className="w-8 h-8"
                                        shape="circle"
                                        style={{
                                            borderColor: user.color,
                                            borderWidth: "2px",
                                            borderStyle: "solid",
                                        }}
                                        template={
                                            user.avatarUrl ? (
                                                <img
                                                    src={user.avatarUrl}
                                                    referrerPolicy="no-referrer"
                                                    alt={user.name}
                                                    className="w-full h-full object-cover rounded-full"
                                                />
                                            ) : (
                                                <span className="text-sm">
                                                    {user.name[0]?.toUpperCase() ??
                                                        "?"}
                                                </span>
                                            )
                                        }
                                    />
                                ))}
                                {overflowCount > 0 && (
                                    <Avatar
                                        label={`+${overflowCount}`}
                                        shape="circle"
                                        style={{
                                            backgroundColor: "#303030",
                                            borderColor: "white",
                                        }}
                                    />
                                )}
                            </AvatarGroup>
                        </>
                    )}
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
