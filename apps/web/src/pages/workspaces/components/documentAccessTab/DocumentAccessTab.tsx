import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { hasWorkspaceRole } from "@converge/shared";
import useDocumentAccessTab from "../../../../hooks/useDocumentAccessTab";
import DefaultDocAccessRow from "./DefaultDocAccessRow";

/** Tab for configuring the document access level for the workspace. */
const DocumentAccessTab = ({ workspaceId }: { workspaceId: number }) => {
    const { role, defaults, isLoading, isSaving, updateDefault } =
        useDocumentAccessTab({ workspaceId });

    const isAdmin = role !== null && hasWorkspaceRole(role, "admin"); // true if the caller can edit member/non-member defaults
    const isOwner = role === "owner"; // true if the caller can also edit the admin default

    return (
        <div>
            <p className="text-text-secondary text-sm">
                Controls the default access level workspace members have on
                documents based on their workspace role. For per-document
                permissions, configure access within the document itself.
            </p>

            {isLoading || !defaults ? (
                <div className="flex items-center justify-center mt-8">
                    <AiOutlineLoading3Quarters className="animate-spin" />
                </div>
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
