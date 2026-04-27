import { useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { IoLibraryOutline, IoLogOutOutline } from "react-icons/io5";
import { authAtom } from "../../../atoms/auth";
import useLogout from "../../../hooks/useLogout";
import { useNavigate } from "react-router-dom";

/**
 * Dropdown menu anchored below the avatar button. Shows the user's avatar,
 * name, and email in a header row, followed by Library and Log out actions.
 * Closes when the user clicks outside the panel.
 */
const AvatarDropdown = ({ onClose }: { onClose: () => void }) => {
    const { user } = useAtomValue(authAtom); // authenticated user, provides name, email, and avatar for the header row
    const panelRef = useRef<HTMLDivElement>(null); // ref used to detect outside clicks
    const navigate = useNavigate(); // used to navigate to /library on the Library button click
    const logout = useLogout(); // clears the auth cookie, resets auth state, and redirects to /

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
            className="absolute right-0 top-full mt-2 w-56 sm:w-72 rounded-lg
             bg-background-overlay z-50 overflow-hidden"
        >
            {/* Header row — avatar left, name and email right */}
            <div className="flex items-center justify-start px-3 sm:px-4 py-2 sm:py-3">
                {user?.avatarUrl && (
                    <img
                        src={user.avatarUrl}
                        alt="Converge"
                        className="h-7 sm:h-9 w-auto rounded-full"
                    />
                )}
                {user && (
                    <div className="flex flex-col items-start min-w-0 ml-2 sm:ml-3 w-full">
                        <span className="text-text-primary text-sm sm:text-base font-medium truncate">
                            {user.name}
                        </span>
                        <span className="opacity-40 text-xs sm:text-sm truncate">
                            {user.email}
                        </span>
                    </div>
                )}
            </div>

            {/* Action rows */}
            <button
                onClick={() => {
                    navigate("/library");
                    onClose();
                }}
                className="w-full flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm transition cursor-pointer bg-transparent text-white border-none
            hover:opacity-80 active:opacity-75"
            >
                <IoLibraryOutline className="w-4 h-4 shrink-0" />
                Library
            </button>
            <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm transition cursor-pointer bg-transparent text-white border-none
            hover:opacity-80 active:opacity-75"
            >
                <IoLogOutOutline className="w-4 h-4 shrink-0" />
                Log out
            </button>
        </div>
    );
};

export default AvatarDropdown;
