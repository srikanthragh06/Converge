import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
    LuChevronsUpDown,
    LuLayoutGrid,
    LuPlus,
    LuSettings,
    LuUsers,
} from "react-icons/lu";
import type { WorkspaceDto } from "@converge/shared";
import { workspaceKeys } from "../../queries/workspaces";
import useCreateWorkspace from "../../hooks/useCreateWorkspace";
import { describeWorkspace } from "../../utils/utils";
import { DropdownMenu, type MenuEntry } from "../ui/Menu";
import WorkspaceConfigModal from "../../pages/workspaces/components/WorkspaceConfigModal";
import CreateWorkspaceModal from "../../pages/workspaces/components/CreateWorkspaceModal";
import WorkspaceTile from "./WorkspaceTile";

/**
 * The sidebar header: the current workspace's tile, name, and the user's
 * place in it, opening a menu to switch workspaces, manage the current one
 * (members, settings), browse all workspaces, or create a new one.
 * @param workspaces - every workspace the user belongs to
 * @param currentWorkspace - the selected workspace's id and name (null until auth loads)
 * @param onSelect - switches to the workspace with the given id
 * @param onOpen - called when the menu opens, e.g. to refetch the workspace list
 * @param onNavigate - called after a menu action that leaves the page, e.g. to close the mobile drawer
 * @param compact - shows only the tile (with a tooltip) and opens the menu
 *                  to the right, for the collapsed icon rail
 */
const WorkspaceSwitcher = ({
    workspaces,
    currentWorkspace,
    onSelect,
    onOpen,
    onNavigate,
    compact = false,
}: {
    workspaces: WorkspaceDto[];
    currentWorkspace: { id: number; name: string } | null;
    onSelect: (id: number) => void;
    onOpen: () => void;
    onNavigate: () => void;
    compact?: boolean;
}) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { createWorkspace, isCreating, error } = useCreateWorkspace(); // creates, selects, and opens a new workspace
    const [configTab, setConfigTab] = useState<string | null>(null); // tab the workspace settings modal is open on; null when closed
    const [isCreateOpen, setIsCreateOpen] = useState(false); // whether the Create workspace modal is open

    // Full record of the current workspace (type and role), once the list has loaded.
    const workspace = workspaces.find((w) => w.id === currentWorkspace?.id);

    const items: MenuEntry[] = [
        {
            type: "label",
            label: (
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                    Switch workspace
                </span>
            ),
        },
        ...workspaces.map(
            (w): MenuEntry => ({
                label: w.name,
                description: describeWorkspace(w),
                icon: <WorkspaceTile name={w.name} type={w.type} />,
                checked: w.id === currentWorkspace?.id,
                onSelect: () => {
                    if (w.id !== currentWorkspace?.id) onSelect(w.id);
                },
            }),
        ),
        { type: "separator" },
        {
            label: "Members & access",
            icon: <LuUsers />,
            onSelect: () => setConfigTab("members"),
            disabled: !currentWorkspace,
        },
        {
            label: "Workspace settings",
            icon: <LuSettings />,
            onSelect: () => setConfigTab("general"),
            disabled: !currentWorkspace,
        },
        {
            label: "All workspaces",
            icon: <LuLayoutGrid />,
            onSelect: () => {
                navigate("/workspaces");
                onNavigate();
            },
        },
        { type: "separator" },
        {
            label: "Create workspace",
            icon: <LuPlus />,
            onSelect: () => setIsCreateOpen(true),
        },
    ];

    return (
        <>
            <DropdownMenu
                align="start"
                side={compact ? "right" : "bottom"}
                items={items}
                onOpenChange={(open) => open && onOpen()}
                className="w-[17.5rem] max-w-[calc(100vw-1rem)]"
                trigger={
                    compact ? (
                        <button
                            type="button"
                            aria-label={`Workspace: ${currentWorkspace?.name ?? ""}`}
                            className="flex cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                        >
                            <WorkspaceTile
                                name={currentWorkspace?.name ?? ""}
                                type={workspace?.type}
                                className="h-8 w-8 text-lg"
                            />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-gold/60 data-[state=open]:bg-surface-hover"
                        >
                            <WorkspaceTile
                                name={currentWorkspace?.name ?? ""}
                                type={workspace?.type}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-semibold text-fg">
                                    {currentWorkspace?.name}
                                </span>
                                {workspace && (
                                    <span className="truncate text-xs text-fg-muted">
                                        {workspace.type === "personal"
                                            ? "Personal"
                                            : describeWorkspace(workspace)}
                                    </span>
                                )}
                            </span>
                            <LuChevronsUpDown className="h-4 w-4 shrink-0 text-fg-muted" />
                        </button>
                    )
                }
            />

            {configTab && currentWorkspace && (
                <WorkspaceConfigModal
                    workspaceId={currentWorkspace.id}
                    initialTab={configTab}
                    onClose={() => {
                        setConfigTab(null);
                        // Pick up a rename or role change made in settings.
                        queryClient.invalidateQueries({
                            queryKey: workspaceKeys.list(),
                        });
                    }}
                />
            )}
            {isCreateOpen && (
                <CreateWorkspaceModal
                    onCreate={async (name) => {
                        if (await createWorkspace(name)) {
                            setIsCreateOpen(false);
                            onNavigate();
                        }
                    }}
                    onCancel={() => setIsCreateOpen(false)}
                    isCreating={isCreating}
                    error={error}
                />
            )}
        </>
    );
};

export default WorkspaceSwitcher;
