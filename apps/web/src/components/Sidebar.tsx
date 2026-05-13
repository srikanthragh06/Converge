import { useAtomValue } from "jotai";
import { authAtom } from "../atoms/auth";
import { IoIosMenu } from "react-icons/io";
import { MdKeyboardDoubleArrowLeft } from "react-icons/md";

/**
 * Collapsible sidebar rendered alongside page content. Shows an expanded
 * panel when open (500px desktop / 200px mobile) and a slim column with
 * just the toggle button when closed.
 */
const Sidebar = ({
    isOpen,
    onToggle,
}: {
    isOpen: boolean;
    onToggle: () => void;
}) => {
    const auth = useAtomValue(authAtom); // Current auth state — drives avatar rendering and user info display.
    const user = auth.status === "authenticated" ? auth.user : null;
    if (isOpen) {
        return (
            <div
                className="max-w-[500px] min-w-[200px] shrink-0 h-full border-r border-border md:p-2
            flex flex-col"
            >
                <div className="flex items-center justify-end">
                    <button
                        onClick={onToggle}
                        className="p-1 rounded-md hover:bg-background-hover transition cursor-pointer"
                        aria-label="Close sidebar"
                    >
                        <MdKeyboardDoubleArrowLeft className="md:w-[20px] md:h-[20px] w-[20px] h-[20px]" />
                    </button>
                </div>
                <div className="flex items-center justify-start pl-1">
                    {user?.avatarUrl && (
                        <img
                            referrerPolicy="no-referrer"
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
                <div></div>
            </div>
        );
    }

    return (
        <div className="w-10 shrink-0 h-full border-r border-border p-2">
            <div className="flex items-center">
                <button
                    onClick={onToggle}
                    className="p-1 rounded-md hover:bg-background-hover transition cursor-pointer"
                    aria-label="Open sidebar"
                >
                    <IoIosMenu className="md:w-[20px] md:h-[20px] w-[20px] h-[20px]" />
                </button>
            </div>
            {/* Closed sidebar content */}
        </div>
    );
};

export default Sidebar;
