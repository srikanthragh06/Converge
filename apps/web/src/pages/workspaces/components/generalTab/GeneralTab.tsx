import useWorkspaceOverview from "../../../../hooks/useWorkspaceOverview";
import LeaveWorkspaceConfirmationModal from "./LeaveWorkspaceConfirmationModal";
import { Skeleton } from "primereact/skeleton";

/**
 * General workspace settings tab. Displays workspace name, type, member
 * and document counts, owner info, and creation date. Fetches its own data
 * and role via useWorkspaceOverview.
 */
const GeneralTab = ({
    workspaceId,
    onLeave,
}: {
    workspaceId: number;
    /** Called after a successful leave so the parent can close and refetch. */
    onLeave?: () => void;
}) => {
    const {
        overview,
        saveStatus,
        save,
        name,
        setName,
        isConfirmOpen,
        setIsConfirmOpen,
        isInitialLoading,
        canLeave,
        handleLeave,
        isLeaving,
    } = useWorkspaceOverview(workspaceId, onLeave);

    if (isInitialLoading) {
        return (
            <div className="flex flex-col gap-3">
                <Skeleton height="1.25rem" width="8rem" className="mb-1" />
                <div className="flex items-center gap-2 mb-2">
                    <Skeleton height="2rem" width="16rem" />
                    <Skeleton height="2rem" width="4rem" />
                </div>
                <Skeleton height="1rem" width="40%" />
                <Skeleton height="1rem" width="35%" />
                <Skeleton height="1rem" width="55%" />
                <Skeleton height="1rem" width="60%" />
                <Skeleton height="1rem" width="45%" />
            </div>
        );
    }

    return (
        <>
            <label className="text-xs sm:text-sm opacity-50 mb-1 block">
                Workspace Name
            </label>
            <div className="flex items-center gap-2 mb-4">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Workspace name"
                    className="w-64 px-2 py-1 text-xs sm:text-sm rounded-md
                    bg-gray-950 outline-none text-white border-0"
                />
                <button
                    onClick={() => save(name)}
                    className="px-3 py-1 text-xs sm:text-sm rounded-md bg-white text-black hover:opacity-90 transition cursor-pointer"
                >
                    {saveStatus === "saving"
                        ? "Saving..."
                        : saveStatus === "saved"
                          ? "Saved!"
                          : "Save"}
                </button>
            </div>
            <div className="flex flex-col space-y-1 sm:space-y-2">
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Type: </span>
                    <span className="text-text-secondary">
                        {overview
                            ? overview.type === "personal"
                                ? "Personal"
                                : "Custom"
                            : "—"}
                    </span>
                </div>
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Members: </span>
                    <span className="text-text-secondary">
                        {overview ? overview.membersCount : "—"}
                    </span>
                </div>
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Documents: </span>
                    <span className="text-text-secondary">
                        {overview ? overview.documentsCount : "—"}
                    </span>
                </div>
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Owner: </span>
                    <span className="text-text-secondary">
                        {overview
                            ? `${overview.ownerName} (${overview.ownerEmail})`
                            : "—"}
                    </span>
                </div>
                <div className="text-xs sm:text-sm">
                    <span className="opacity-50">Created on: </span>
                    <span className="text-text-secondary">
                        {overview
                            ? new Date(overview.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                  },
                              )
                            : "—"}
                    </span>
                </div>
            </div>

            {canLeave && (
                <button
                    onClick={() => setIsConfirmOpen(true)}
                    className="border-none bg-red-800 text-white text-xs sm:text-sm
            text-center rounded-lg px-3 py-1 mt-8 sm:mt-10 cursor-pointer
            hover:opacity-80 active:opacity-70 transition w-40"
                >
                    Leave Workspace
                </button>
            )}
            {!isInitialLoading && !canLeave && (
                <p className="text-xs opacity-40 mt-8 sm:mt-10">
                    To leave this workspace, you must not be the owner and this
                    workspace must not be your selected workspace.
                </p>
            )}

            {isConfirmOpen && (
                <LeaveWorkspaceConfirmationModal
                    workspaceName={overview?.name ?? "this workspace"}
                    onCancel={() => setIsConfirmOpen(false)}
                    onConfirm={handleLeave}
                    isLeaving={isLeaving}
                />
            )}
        </>
    );
};

export default GeneralTab;
