import { hasWorkspaceRole } from "@converge/shared";
import useDocumentAccessTab from "../../../../hooks/useDocumentAccessTab";
import DefaultDocAccessRow from "./DefaultDocAccessRow";
import { Skeleton } from "primereact/skeleton";
import DelayedRender from "../../../../components/DelayedRender";

/** Tab for configuring the document access level for the workspace. */
const DocumentAccessTab = ({ workspaceId }: { workspaceId: number }) => {
    const { role, defaults, isLoading, isSaving, updateDefault } =
        useDocumentAccessTab({ workspaceId });

    const isAdmin = role !== null && hasWorkspaceRole(role, "admin"); // true if the caller can edit member/non-member defaults
    const isOwner = role === "owner"; // true if the caller can also edit the admin default

    return (
        <div>
            <p className="text-xs opacity-50">
                Controls the default access level workspace members have on
                documents based on their workspace role. For per-document
                permissions, configure access within the document itself.
            </p>

            {isLoading || !defaults ? (
                <DelayedRender>
                    <div className="flex flex-col gap-2 mt-4">
                        <Skeleton height="2rem" width="100%" />
                        <Skeleton height="2rem" width="100%" />
                        <Skeleton height="2rem" width="100%" />
                    </div>
                </DelayedRender>
            ) : (
                <div className="mt-4">
                    <DefaultDocAccessRow
                        label="Admin"
                        field="adminDocAccess"
                        value={defaults.adminDocAccess}
                        disabled={!isOwner}
                        isSaving={isSaving}
                        onUpdate={updateDefault}
                    />
                    <DefaultDocAccessRow
                        label="Member"
                        field="memberDocAccess"
                        value={defaults.memberDocAccess}
                        disabled={!isAdmin}
                        isSaving={isSaving}
                        onUpdate={updateDefault}
                    />
                    <DefaultDocAccessRow
                        label="Non-member"
                        field="nonMemberDocAccess"
                        value={defaults.nonMemberDocAccess}
                        disabled={!isAdmin}
                        isSaving={isSaving}
                        onUpdate={updateDefault}
                    />
                </div>
            )}
        </div>
    );
};

export default DocumentAccessTab;
