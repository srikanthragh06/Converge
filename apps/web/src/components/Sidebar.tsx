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
    if (isOpen) {
        return (
            <div className="md:w-[500px] w-[200px] shrink-0 h-full border-r border-border md:p-2">
                <div className="flex items-center">
                    <button
                        onClick={onToggle}
                        className="p-1 rounded-md hover:bg-background-hover transition cursor-pointer"
                        aria-label="Close sidebar"
                    >
                        <MdKeyboardDoubleArrowLeft className="md:w-[30px] md:h-[30px] w-[20px] h-[20px]" />
                    </button>
                </div>
                {/* Open sidebar content */}
            </div>
        );
    }

    return (
        <div className="md:w-14 w-8 shrink-0 h-full border-r border-border md:p-2">
            <div className="flex items-center">
                <button
                    onClick={onToggle}
                    className="p-1 rounded-md hover:bg-background-hover transition cursor-pointer"
                    aria-label="Open sidebar"
                >
                    <IoIosMenu className="md:w-[30px] md:h-[30px] w-[20px] h-[20px]" />
                </button>
            </div>
            {/* Closed sidebar content */}
        </div>
    );
};

export default Sidebar;
