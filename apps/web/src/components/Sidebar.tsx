import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { authAtom } from "../atoms/auth";
import useSidebar from "../hooks/useSidebar";
import useLogout from "../hooks/useLogout";
import { IoIosMenu } from "react-icons/io";
import {
    MdKeyboardDoubleArrowLeft,
    MdNoteAdd,
    MdWorkspaces,
    MdLibraryBooks,
    MdLogout,
    MdDescription,
} from "react-icons/md";
import { Dropdown } from "primereact/dropdown";
import "primereact/resources/themes/lara-dark-blue/theme.css";
import { CiSettings } from "react-icons/ci";

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
    const navigate = useNavigate();
    const logout = useLogout(); // logs the user out and redirects to /
    const auth = useAtomValue(authAtom); // Current auth state — drives avatar rendering and user info display.
    const user = auth.status === "authenticated" ? auth.user : null;
    const {
        workspaces,
        currentWorkspace,
        recentDocuments,
        isCreating,
        selectWorkspace,
        createDocument,
        refetchWorkspaces,
    } = useSidebar(); // Workspace list, recent docs, selected workspace state, create/handle workspace actions.

    if (isOpen) {
        return (
            <div
                className="sm:w-[500px] min-w-[200px] shrink-0 h-full border-r border-border md:p-2 p-1
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
                <div className="mt-4 flex flex-col sm:space-y-2 space-y-1">
                    <div className="flex items-center space-x-2">
                        <p className="opacity-50 sm:text-sm text-xs">
                            Current Workspace
                        </p>
                        <CiSettings className="w-4 h-4 sm:w-5 sm:h-5 text-white hover:opacity-80 transition cursor-pointer shrink-0" />
                    </div>

                    <Dropdown
                        value={currentWorkspace?.id ?? null}
                        options={workspaces.map((w) => ({
                            label: w.name,
                            value: w.id,
                            type: w.type,
                        }))}
                        onChange={(e) => selectWorkspace(e.value)}
                        onShow={refetchWorkspaces}
                        className="text-xs sm:text-sm"
                        itemTemplate={(option) => (
                            <div className="flex items-center justify-between w-full">
                                <span className="truncate">{option.label}</span>
                                {option.type === "personal" && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-medium ml-2 shrink-0">
                                        Personal
                                    </span>
                                )}
                            </div>
                        )}
                        valueTemplate={(option) =>
                            option && (
                                <div className="flex items-center gap-2">
                                    <span className="truncate">
                                        {option.label}
                                    </span>
                                    {option.type === "personal" && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-medium shrink-0">
                                            Personal
                                        </span>
                                    )}
                                </div>
                            )
                        }
                        pt={{
                            root: {
                                className:
                                    "border border-border/70 bg-transparent focus:outline-none",
                            },
                            input: {
                                className:
                                    "text-xs sm:text-sm text-white py-0.5 sm:py-1 px-1.5 sm:px-2 overflow-hidden text-ellipsis whitespace-nowrap max-w-full",
                            },
                            trigger: { className: "text-white" },
                            panel: {
                                className:
                                    "bg-background-base border border-gray-700",
                            },
                            item: {
                                className:
                                    "text-xs sm:text-sm text-white hover:bg-background-elevated px-2 sm:px-3 py-1.5 sm:py-2",
                            },
                        }}
                    />
                </div>
                <div className="mt-3 flex flex-col space-y-0">
                    <button
                        onClick={createDocument}
                        disabled={isCreating}
                        className="flex justify-start items-center gap-2 text-left py-1 px-2 hover:bg-background-hover rounded-md transition cursor-pointer text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="New Document"
                    >
                        <MdNoteAdd className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="text-sm sm:text-base">
                            New Document
                        </span>
                    </button>
                    <button
                        onClick={() => navigate("/library")}
                        className="flex justify-start items-center gap-2 text-left py-1 px-2 hover:bg-background-hover rounded-md transition cursor-pointer text-text-primary"
                        aria-label="Library"
                    >
                        <MdLibraryBooks className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="text-sm sm:text-base">Library</span>
                    </button>
                    <button
                        onClick={() => navigate("/workspaces")}
                        className="flex justify-start items-center gap-2 text-left py-1 px-2 hover:bg-background-hover rounded-md transition cursor-pointer text-text-primary"
                        aria-label="Workspaces"
                    >
                        <MdWorkspaces className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="text-sm sm:text-base">Workspaces</span>
                    </button>
                    <button
                        onClick={logout}
                        className="flex justify-start items-center gap-2 text-left py-1 px-2 mt-2 hover:bg-background-hover rounded-md transition cursor-pointer text-text-primary"
                        aria-label="Log out"
                    >
                        <MdLogout className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        <span className="text-sm sm:text-base">Log out</span>
                    </button>
                </div>
                <div className="mt-4 flex flex-col space-y-1">
                    <p className="opacity-50 text-xs">Documents</p>
                    <div className="flex flex-col">
                        {recentDocuments.length === 0 && (
                            <span className="text-xs opacity-40 px-2 py-1">
                                No recent documents
                            </span>
                        )}
                        {recentDocuments.map((doc) => (
                            <button
                                key={doc.id}
                                onClick={() => navigate(`/document/${doc.id}`)}
                                className="flex justify-start items-center gap-2 text-left py-1 px-2 hover:bg-background-hover
                            rounded-md transition cursor-pointer text-text-primary"
                                aria-label={doc.title}
                            >
                                <MdDescription
                                    className={`w-3 h-3 shrink-0 ${!doc.title ? "opacity-40" : ""}`}
                                />
                                <span
                                    className={`text-xs sm:text-sm truncate ${!doc.title ? "opacity-40" : ""}`}
                                >
                                    {doc.title || "Untitled"}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="sm:w-14 w-10 shrink-0 h-full border-r border-border p-2">
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
