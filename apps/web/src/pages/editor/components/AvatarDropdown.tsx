import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { authAtom } from "../../../atoms/auth";

/**
 * Dropdown menu anchored below the avatar button. Shows the user's avatar,
 * name, and email in a header row, followed by Library and Log out actions.
 * Closes when the user clicks outside the panel.
 */
const AvatarDropdown = ({ onClose }: { onClose: () => void }) => {
    const { user } = useAtomValue(authAtom); // authenticated user, provides name, email, and avatar for the header row
    const panelRef = useRef<HTMLDivElement>(null); // ref used to detect outside clicks

    // Closes the dropdown when the user clicks anywhere outside the panel.
    useEffect(() => {
        const handlePointerDown = (e: PointerEvent) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () =>
            document.removeEventListener("pointerdown", handlePointerDown);
    }, [onClose]);

    return (
        <div
            ref={panelRef}
            className="absolute right-0 top-full mt-2 w-72 rounded-lg
             bg-background-overlay z-50 overflow-hidden"
        >
            {/* Header row — avatar left, name and email right */}
            <div className="flex items-center justify-start px-4 py-3">
                {user?.avatarUrl && (
                    <img
                        src={user.avatarUrl}
                        alt="Converge"
                        className="h-9 w-auto rounded-full"
                    />
                )}
                {user && (
                    <div className="flex flex-col items-start min-w-0 ml-3 w-full">
                        <span className="text-text-primary text-base font-medium truncate">
                            {user.name}
                        </span>
                        <span className="opacity-40 text-sm truncate">
                            {user.email}
                        </span>
                    </div>
                )}
            </div>

            {/* Action rows */}
            <button
                className="w-full text-left px-4 py-2.5 text-sm transition cursor-pointer bg-transparent text-white border-none
            hover:opacity-90 active:opacity-75"
            >
                Library
            </button>
            <button
                className="w-full text-left px-4 py-2.5 text-sm transition cursor-pointer bg-transparent text-white border-none
            hover:opacity-90 active:opacity-75"
            >
                Log out
            </button>
        </div>
    );
};

export default AvatarDropdown;
