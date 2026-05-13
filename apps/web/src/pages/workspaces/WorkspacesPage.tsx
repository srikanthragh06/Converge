import { useState } from "react";
import Page from "../../components/Page";
import useCreateWorkspace from "../../hooks/useCreateWorkspace";
import CreateWorkspaceModal from "./components/CreateWorkspaceModal";

/**
 * Full-screen workspaces page. Lists the authenticated user's workspaces
 * and allows switching between them.
 */
const WorkspacesPage = () => {
    const { createWorkspace, isCreating, error } = useCreateWorkspace();
    const [showModal, setShowModal] = useState(false);

    const handleCreate = async (name: string) => {
        const ok = await createWorkspace(name);
        if (ok) setShowModal(false);
    };

    return (
        <Page authRequired haveSidebar>
            <div
                className="mr-10 bg-background-base sticky top-[52px] sm:top-[76px] z-40 pb-4 pt-4 sm:pt-8 w-full
                    flex flex-col space-y-4"
            >
                <div
                    className="text-text-primary px-4 sm:px-8 font-bold
                                flex sm:justify-center justify-start"
                >
                    <h1 className="sm:text-4xl text-2xl sm:mr-[560px]">
                        Workspaces
                    </h1>
                </div>
                <div className="w-full flex flex-col items-center space-y-2 sm:flex-row sm:justify-center sm:space-y-0 sm:space-x-8">
                    <input
                        type="text"
                        placeholder="Search workspaces..."
                        className="sm:w-[500px] w-5/6 px-3 py-1 sm:text-base text-sm rounded-md
                        bg-background-elevated
                        outline-none text-white border-0"
                    />
                    <button
                        onClick={() => setShowModal(true)}
                        className="hidden sm:block sm:px-3 sm:py-1 px-2 py-1 sm:text-sm text-xs rounded-md bg-white text-black
                         hover:opacity-90 active:opacity-80 transition
                        cursor-pointer"
                    >
                        <span>New Workspace</span>
                    </button>
                </div>
            </div>

            {showModal && (
                <CreateWorkspaceModal
                    onCreate={handleCreate}
                    onCancel={() => setShowModal(false)}
                    isCreating={isCreating}
                    error={error}
                />
            )}
        </Page>
    );
};

export default WorkspacesPage;
