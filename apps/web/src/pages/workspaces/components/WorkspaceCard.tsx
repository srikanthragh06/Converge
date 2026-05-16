import { MdOutlineWorkspaces } from "react-icons/md";
import type { WorkspaceDto } from "@converge/shared";

/**
 * A single workspace card showing name, type badge, role, and action buttons.
 */
const WorkspaceCard = ({
    workspace,
    onSelect,
    onManage,
}: {
    workspace: WorkspaceDto;
    onSelect: (id: number) => void;
    onManage: (id: number) => void;
}) => {
    return (
        <div
            className="flex items-start sm:px-4 sm:py-3 py-2 px-3
            rounded-lg bg-background
            transition w-11/12 sm:w-[600px] gap-3
            hover:opacity-85"
        >
            <MdOutlineWorkspaces className="w-4 h-4 mt-0.5 shrink-0 opacity-40" />
            <div className="flex flex-col space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-white font-medium sm:text-base text-sm truncate">
                        {workspace.name}
                    </span>
                    {workspace.type === "personal" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-medium shrink-0">
                            Personal
                        </span>
                    )}
                </div>
                <div className="flex flex-col space-y-2">
                    <span className="text-xs opacity-50 capitalize">
                        {workspace.role}
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onManage(workspace.id)}
                            className="text-xs text-white hover:opacity-80 transition cursor-pointer"
                        >
                            Manage Workspace
                        </button>{" "}
                        <button
                            disabled={workspace.isSelected}
                            onClick={() => onSelect(workspace.id)}
                            className={`text-xs transition cursor-pointer text-white ${
                                workspace.isSelected
                                    ? "bg-green-900 rounded-lg cursor-auto"
                                    : "hover:opacity-80"
                            }`}
                        >
                            {workspace.isSelected
                                ? "Selected"
                                : "Select Workspace"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceCard;
