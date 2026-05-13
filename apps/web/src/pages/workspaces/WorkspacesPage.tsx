import { useState } from "react";
import Page from "../../components/Page";
import useCreateWorkspace from "../../hooks/useCreateWorkspace";
import useWorkspaces from "../../hooks/useWorkspaces";
import WorkspaceCard from "./components/WorkspaceCard";
import WorkspaceConfigModal from "./components/WorkspaceConfigModal";
import CreateWorkspaceModal from "./components/CreateWorkspaceModal";

/**
 * Full-screen workspaces page. Lists the authenticated user's workspaces
 * and allows switching between them.
 */
const WorkspacesPage = () => {
    const { createWorkspace, isCreating, error } = useCreateWorkspace();
    const {
        searchText,
        setSearchText,
        workspaces,
        isLoading,
        selectWorkspace,
    } = useWorkspaces();
    const [showModal, setShowModal] = useState(false);
    const [configModal, setConfigModal] = useState<{
        isOpen: boolean;
        workspaceId: number | null;
    }>({ isOpen: false, workspaceId: null }); // Controls workspace config modal visibility and target workspace.

    /**
     * Creates a workspace via the useCreateWorkspace hook and closes the
     * modal on success.
     */
    const handleCreate = async (name: string) => {
        const ok = await createWorkspace(name);
        if (ok) setShowModal(false);
    };

    return (
        <Page authRequired haveSidebar>
            <div
                className="bg-background-base pb-4 pt-4 sm:pt-8 w-full
                    flex flex-col space-y-4"
            >
                <div className="flex flex-col items-center w-full px-4 sm:px-0">
                    <div className="w-full sm:max-w-[720px]">
                        <div
                            className="text-text-primary font-bold
                                        flex justify-start sm:mb-4 mb-2"
                        >
                            <h1 className="sm:text-3xl text-xl">Workspaces</h1>
                        </div>
                        <div className="w-full flex flex-row items-center justify-start space-x-2 sm:space-x-8">
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Search workspaces..."
                                className="flex-1 sm:w-[500px] sm:flex-none px-3 py-1 sm:text-base text-sm rounded-md
                                bg-background-elevated
                                outline-none text-white border-0"
                            />
                            <button
                                onClick={() => setShowModal(true)}
                                className="block sm:px-3 sm:py-1 px-2 py-1 sm:text-sm text-xs rounded-md bg-white text-black
                                 hover:opacity-90 active:opacity-80 transition
                                cursor-pointer"
                            >
                                <span className="sm:hidden">+</span>
                                <span className="hidden sm:inline">
                                    New Workspace
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col items-center gap-2 pb-6">
                {isLoading && workspaces.length === 0 && (
                    <span className="text-sm opacity-40 mt-8">Loading...</span>
                )}

                {!isLoading && workspaces.length === 0 && (
                    <span className="text-sm opacity-40 mt-8">
                        No workspaces found
                    </span>
                )}

                {workspaces.map((w) => (
                    <WorkspaceCard
                        key={w.id}
                        workspace={w}
                        onSelect={selectWorkspace}
                        onManage={(id) =>
                            setConfigModal({ isOpen: true, workspaceId: id })
                        }
                    />
                ))}
            </div>

            {showModal && (
                <CreateWorkspaceModal
                    onCreate={handleCreate}
                    onCancel={() => setShowModal(false)}
                    isCreating={isCreating}
                    error={error}
                />
            )}

            {configModal.isOpen && configModal.workspaceId && (
                <WorkspaceConfigModal
                    workspaceId={configModal.workspaceId}
                    onClose={() =>
                        setConfigModal({ isOpen: false, workspaceId: null })
                    }
                />
            )}
        </Page>
    );
};

export default WorkspacesPage;
