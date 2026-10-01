import { useState } from "react";
import { LuPlus, LuSearch } from "react-icons/lu";
import Page from "../../components/Page";
import Input from "../../components/ui/Input";
import TableSkeleton from "../../components/ui/TableSkeleton";
import { PageContainer, PageHeader } from "../../components/ui/PageHeader";
import { Table, TableHeadCell, TableHeader } from "../../components/ui/Table";
import useCreateWorkspace from "../../hooks/useCreateWorkspace";
import useSelectWorkspace from "../../hooks/useSelectWorkspace";
import useWorkspaces from "../../hooks/useWorkspaces";
import WorkspaceRow from "./components/WorkspaceRow";
import WorkspaceConfigModal from "./components/WorkspaceConfigModal";
import CreateWorkspaceModal from "./components/CreateWorkspaceModal";

/**
 * Workspaces page (pp 31 / 39): every workspace the user belongs to, with a
 * filter, a New workspace button (dialog pp 32 / 40), and per row Switch to
 * this and a settings gear that opens the workspace settings.
 */
const WorkspacesPage = () => {
    const [searchText, setSearchText] = useState(""); // the filter box's text
    const { workspaces, isLoading } = useWorkspaces(searchText); // the full list, or the matches for searchText
    const { selectWorkspace } = useSelectWorkspace();
    const [showModal, setShowModal] = useState(false); // controls Create Workspace modal visibility
    const [configWorkspaceId, setConfigWorkspaceId] = useState<number | null>(
        null,
    ); // workspace whose settings are open, or null when closed
    const { createWorkspace, isCreating } = useCreateWorkspace({
        onSuccess: () => setShowModal(false),
    });

    return (
        <Page authRequired haveSidebar mobileTitle="Workspaces">
            <div className="flex-1 overflow-y-auto">
                <PageContainer>
                    <PageHeader
                        title="Workspaces"
                        description="Switch between workspaces or open their settings."
                        action={{
                            label: "New workspace",
                            icon: <LuPlus />,
                            onClick: () => setShowModal(true),
                        }}
                    >
                        <Input
                            inputSize="lg"
                            icon={<LuSearch />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Filter workspaces"
                            aria-label="Filter workspaces"
                        />
                    </PageHeader>
                    <Table
                        columns="minmax(0,1fr) 10rem 9.5rem"
                        mobileColumns="minmax(0,1fr) auto"
                    >
                        <TableHeader>
                            <TableHeadCell>Name</TableHeadCell>
                            <TableHeadCell hideOnMobile>
                                Your role
                            </TableHeadCell>
                            <TableHeadCell />
                        </TableHeader>
                        {isLoading && workspaces.length === 0 && (
                            <TableSkeleton rows={4} />
                        )}
                        {!isLoading && workspaces.length === 0 && (
                            <p className="py-10 text-center text-sm text-fg-muted">
                                No workspaces match this filter.
                            </p>
                        )}
                        {workspaces.map((w) => (
                            <WorkspaceRow
                                key={w.id}
                                workspace={w}
                                onSwitch={() => selectWorkspace(w.id)}
                                onOpenSettings={() =>
                                    setConfigWorkspaceId(w.id)
                                }
                            />
                        ))}
                    </Table>
                </PageContainer>
            </div>

            {showModal && (
                <CreateWorkspaceModal
                    onCreate={createWorkspace}
                    onCancel={() => setShowModal(false)}
                    isCreating={isCreating}
                />
            )}

            {configWorkspaceId !== null && (
                <WorkspaceConfigModal
                    workspaceId={configWorkspaceId}
                    onClose={() => setConfigWorkspaceId(null)}
                />
            )}
        </Page>
    );
};

export default WorkspacesPage;
