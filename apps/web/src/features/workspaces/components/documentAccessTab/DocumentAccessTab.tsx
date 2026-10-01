import { hasWorkspaceRole } from "@converge/shared";
import useDocAccessDefaults from "@/features/workspaces/hooks/useDocAccessDefaults";
import useMyWorkspaceRole from "@/features/workspaces/hooks/useMyWorkspaceRole";
import useUpdateDocAccessDefault from "@/features/workspaces/hooks/useUpdateDocAccessDefault";
import DefaultDocAccessRow from "./DefaultDocAccessRow";
import AccessRulesCard from "./AccessRulesCard";
import Skeleton from "@/components/ui/Skeleton";
import DelayedRender from "@/components/common/DelayedRender";

/**
 * Default access tab of workspace settings (pp 20 / 27): each workspace
 * role's default access to documents, and how access is decided. Only the
 * owner can change the Admins default; admins can change the other two.
 * @param workspaceId - the workspace being configured
 */
const DocumentAccessTab = ({ workspaceId }: { workspaceId: number }) => {
    const { role } = useMyWorkspaceRole(workspaceId);
    const { defaults } = useDocAccessDefaults(workspaceId);
    const { updateDefault, isSaving } = useUpdateDocAccessDefault(workspaceId);

    const isAdmin = role !== null && hasWorkspaceRole(role, "admin"); // true if the caller can edit member/non-member defaults
    const isOwner = role === "owner"; // true if the caller can also edit the admin default

    return (
        <div className="flex flex-col">
            {!defaults ? (
                <DelayedRender>
                    <div className="flex flex-col gap-3">
                        <Skeleton height="3rem" />
                        <Skeleton height="3rem" />
                        <Skeleton height="3rem" />
                    </div>
                </DelayedRender>
            ) : (
                <div className="flex flex-col divide-y divide-line-subtle">
                    <DefaultDocAccessRow
                        label="Admins"
                        description="Workspace admins"
                        field="adminDocAccess"
                        value={defaults.adminDocAccess}
                        disabled={!isOwner}
                        isSaving={isSaving}
                        onUpdate={updateDefault}
                    />
                    <DefaultDocAccessRow
                        label="Members"
                        description="Everyone else in the workspace"
                        field="memberDocAccess"
                        value={defaults.memberDocAccess}
                        disabled={!isAdmin}
                        isSaving={isSaving}
                        onUpdate={updateDefault}
                    />
                    <DefaultDocAccessRow
                        label="Non-members"
                        description="People outside this workspace"
                        field="nonMemberDocAccess"
                        value={defaults.nonMemberDocAccess}
                        disabled={!isAdmin}
                        isSaving={isSaving}
                        onUpdate={updateDefault}
                    />
                </div>
            )}
            <AccessRulesCard />
        </div>
    );
};

export default DocumentAccessTab;
