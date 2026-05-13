import { useEffect, useState } from "react";
import useWorkspaceOverview from "../../../../hooks/useWorkspaceOverview";

/**
 * General workspace settings tab. Displays workspace name, type, member
 * and document counts, owner info, and creation date.
 */
const GeneralTab = ({ workspaceId }: { workspaceId: number }) => {
    const { overview, isLoading, saveStatus, save } =
        useWorkspaceOverview(workspaceId);
    const [name, setName] = useState(""); // editable workspace name, seeded from overview

    // Seed the name input when overview loads.
    useEffect(() => {
        if (overview) setName(overview.name);
    }, [overview]);

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
        </>
    );
};

export default GeneralTab;
