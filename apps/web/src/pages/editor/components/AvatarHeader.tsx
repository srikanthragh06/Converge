import { useState } from "react";
import { useAtomValue } from "jotai";
import { RxAvatar } from "react-icons/rx";
import { authAtom } from "../../../atoms/auth";
import AvatarDropdown from "./AvatarDropdown";

/**
 * Avatar button with an attached dropdown. Reads the authenticated user
 * from the global atom. Shows the user's profile picture if available,
 * or a generic avatar icon otherwise. Clicking toggles the AvatarDropdown.
 */
const AvatarHeader = () => {
    const { user } = useAtomValue(authAtom); // authenticated user, provides avatar URL and display name
    const [isDropdownOpen, setIsDropdownOpen] = useState(false); // controls whether the account dropdown is visible

    return (
        <div className="relative">
            {user?.avatarUrl ? (
                <img
                    src={user.avatarUrl}
                    alt={user.name}
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    className="sm:w-10 sm:h-10 h-8 w-8 rounded-full object-cover
                    cursor-pointer hover:opacity-80 transition"
                />
            ) : (
                <RxAvatar
                    onClick={() => setIsDropdownOpen((prev) => !prev)}
                    className="sm:w-10 sm:h-10 h-8 w-8 text-text-secondary
                    cursor-pointer hover:opacity-80 transition"
                />
            )}
            {isDropdownOpen && (
                <AvatarDropdown onClose={() => setIsDropdownOpen(false)} />
            )}
        </div>
    );
};

export default AvatarHeader;
