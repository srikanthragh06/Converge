import { useState } from "react";
import { IoMdCloseCircleOutline } from "react-icons/io";
import GeneralTab from "./generalTab/GeneralTab";
import MembersTab from "./membersTab/MembersTab";

/** Sidebar tab entries; extend this array to add new tabs. */
const TABS: { key: string; label: string }[] = [
    { key: "general", label: "General" },
    { key: "members", label: "Members" },
];

/**
 * Workspace configuration modal with tabbed sidebar. Matches the
 * ManageDocumentModal layout pattern.
 */
const WorkspaceConfigModal = ({
    workspaceId,
    onClose,
    onLeave,
}: {
    workspaceId: number;
    onClose: () => void;
    onLeave: () => void;
}) => {
    const [selectedTab, setSelectedTab] = useState("general"); // Currently active tab key.

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-background-base w-full sm:max-w-4xl sm:mx-4
                rounded-xl h-[80dvh] sm:h-[70vh]
                flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sm:hidden flex items-center justify-end p-2 sm:p-3">
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="opacity-60 hover:opacity-100 transition cursor-pointer"
                    >
                        <IoMdCloseCircleOutline className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row h-full min-h-0">
                    <div
                        className="flex flex-row sm:flex-col shrink-0 p-2 gap-1 overflow-x-auto sm:overflow-x-visible"
                        style={{ scrollbarWidth: "thin" }}
                    >
                        {TABS.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setSelectedTab(key)}
                                className={`shrink-0 text-text-secondary sm:text-base text-sm sm:pl-3 sm:pr-6 px-2 py-2 cursor-pointer
                                border-none text-start rounded-lg transition
                                ${
                                    selectedTab === key
                                        ? "bg-background-elevated"
                                        : "bg-transparent hover:opacity-80 active:opacity-75"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="h-[1px] w-full sm:h-auto sm:w-[1px] bg-background-elevated shrink-0" />
                    <div className="flex-1 min-h-0 flex flex-col px-4 py-3 sm:px-6 sm:py-5">
                        {selectedTab === "general" && (
                            <GeneralTab
                                workspaceId={workspaceId}
                                onLeave={onLeave}
                            />
                        )}
                        {selectedTab === "members" && (
                            <MembersTab workspaceId={workspaceId} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceConfigModal;
