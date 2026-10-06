import { LuSettings } from "react-icons/lu";
import type { WorkspaceDto } from "@converge/shared";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Tooltip from "@/components/ui/Tooltip";
import WorkspaceTile from "./WorkspaceTile";
import { RowActions, TableCell, TableRow } from "@/components/common/Table";

/**
 * The user's role, capitalized for display ("Owner", "Admin", "Member").
 * @param role - the role as the API returns it
 */
const formatRole = (role: string) =>
    role.charAt(0).toUpperCase() + role.slice(1);

/**
 * One row of the Workspaces table (pp 31 / 39): tile, name with Personal and
 * Current badges, and the user's role. Hovering reveals Switch to this (not
 * on the current workspace) and a settings gear; the current workspace's
 * gear is always shown. Below 1024px (phones, tablets) the role moves under the name.
 * @param workspace - the row's workspace
 * @param onSwitch - makes it the current workspace
 * @param onOpenSettings - opens its settings
 */
const WorkspaceRow = ({
    workspace,
    onSwitch,
    onOpenSettings,
}: {
    workspace: WorkspaceDto;
    onSwitch: () => void;
    onOpenSettings: () => void;
}) => (
    <TableRow className="min-h-[3.75rem] has-[[data-state=open]]:bg-surface-hover">
        <TableCell className="gap-3">
            <WorkspaceTile
                name={workspace.name}
                type={workspace.type}
                className="h-[30px] w-[30px] text-lg"
            />
            <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 items-center gap-2">
                    <Tooltip content={workspace.name}>
                        <span className="truncate text-base text-fg">
                            {workspace.name}
                        </span>
                    </Tooltip>
                    {workspace.type === "personal" && <Badge>Personal</Badge>}
                    {workspace.isSelected && (
                        <Badge variant="gold">Current</Badge>
                    )}
                </div>
                <span className="text-xs text-fg-muted lg:hidden">
                    {formatRole(workspace.role)}
                </span>
            </div>
        </TableCell>
        <TableCell hideOnMobile>{formatRole(workspace.role)}</TableCell>
        <RowActions className={cn(workspace.isSelected && "opacity-100")}>
            {!workspace.isSelected && (
                <Button
                    size="sm"
                    onClick={onSwitch}
                    className="sm:h-8 sm:px-3 sm:text-sm"
                >
                    Switch to this
                </Button>
            )}
            <Tooltip content="Workspace settings">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onOpenSettings}
                    aria-label="Workspace settings"
                >
                    <LuSettings />
                </Button>
            </Tooltip>
        </RowActions>
    </TableRow>
);

export default WorkspaceRow;
