import { useState } from "react";
import { useAtomValue } from "jotai";
import { authAtom } from "../../../atoms/auth";
import { syncStatusAtom } from "../../../atoms/socket";
import AnimatedDots from "../../../components/AnimatedDots";
import AvatarDropdown from "./AvatarDropdown";

/**
 * Top navigation bar for the editor page. Shows a sync/loading status
 * indicator on the right alongside the Manage Document button and user avatar.
 * Clicking the avatar toggles the account dropdown.
 */
const EditorPageHeader = ({
    documentStatus,
}: {
    documentStatus: "loading" | "ready" | "forbidden" | "notFound";
}) => {
    const { user } = useAtomValue(authAtom); // authenticated user, used to display the avatar and dropdown info
    const syncStatus = useAtomValue(syncStatusAtom); // current sync state from useYjsSync
    const [isDropdownOpen, setIsDropdownOpen] = useState(false); // controls avatar dropdown visibility

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
        <div className="bg-background-base flex justify-end sm:px-8 px-2 py-2">
            <div className="flex items-center sm:space-x-8 sm:py-2 space-x-4">
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
                    hover:opacity-90 active:opacity-80 transition cursor-pointer mb-1"
                >
                    Manage Document
                </button>

                {/* Avatar button — toggles the account dropdown */}
                {user?.avatarUrl && (
                    <div className="relative">
                        <img
                            src={user.avatarUrl}
                            alt={user.name}
                            onClick={() => setIsDropdownOpen((prev) => !prev)}
                            className="sm:w-10 sm:h-10 h-8 w-8 rounded-full object-cover
                            cursor-pointer hover:opacity-80 transition"
                        />
                        {isDropdownOpen && (
                            <AvatarDropdown
                                onClose={() => setIsDropdownOpen(false)}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditorPageHeader;
