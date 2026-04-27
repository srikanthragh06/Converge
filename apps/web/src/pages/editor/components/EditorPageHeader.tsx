import { useAtomValue } from "jotai";
import { authAtom } from "../../../atoms/auth";
import { syncStatusAtom } from "../../../atoms/socket";
import AnimatedDots from "../../../components/AnimatedDots";

/**
 * Top navigation bar for the editor page. Shows a sync/loading status
 * indicator on the right alongside the Manage Document button and user avatar.
 */
const EditorPageHeader = ({
    documentStatus,
}: {
    documentStatus: "loading" | "ready" | "forbidden" | "notFound";
}) => {
    const { user } = useAtomValue(authAtom); // authenticated user, used to display the avatar
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
        <div
            className="bg-background-base flex justify-end sm:px-8 px-2 py-2"
        >
            <div className="flex items-center sm:space-x-8 sm:py-2 space-x-2">
                {statusLabel && (
                    <span
                        className="text-text-secondary sm:text-sm text-xs opacity-40 
                                    hidden sm:block"
                    >
                        {statusLabel}
                        {statusLabel !== null && statusLabel !== "Offline" && (
                            <AnimatedDots />
                        )}
                    </span>
                )}
                <button
                    className="sm:px-3 sm:py-1 py-1 px-2 sm:text-sm text-xs rounded-md bg-background-overlay text-white
                    border-none
                    hover:opacity-90 active:opacity-80 transition cursor-pointer"
                >
                    Manage Document
                </button>
                {user?.avatarUrl && (
                    <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="sm:w-10 sm:h-10 h-6 w-6 rounded-full object-cover
                        cursor-pointer hover:opacity-80 transition"
                    />
                )}
            </div>
        </div>
    );
};

export default EditorPageHeader;
