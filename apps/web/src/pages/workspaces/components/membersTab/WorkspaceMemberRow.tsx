import { LuLock, LuX } from "react-icons/lu";
import type { WorkspaceMemberDto, WorkspaceRole } from "@converge/shared";
import PersonRow from "../../../../components/people/PersonRow";
import Select, { type SelectOption } from "../../../../components/ui/Select";
import Button from "../../../../components/ui/Button";

/** Roles the owner can give an existing member. */
const ROLE_OPTIONS: SelectOption<WorkspaceRole>[] = [
    { label: "Admin", value: "admin" },
    { label: "Member", value: "member" },
];

/** Display label per workspace role. */
const ROLE_LABELS: Record<WorkspaceRole, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
};

/**
 * One member in the Members tab (pp 19 / 26). The owner's row shows a lock
 * and "Owner". The workspace owner gets a role dropdown and a remove (×)
 * button on every other row; an admin can only remove plain members; anyone
 * else sees the role as text. Nobody can change their own row.
 * @param member - the member
 * @param isSelf - whether this is the caller's own row
 * @param callerRole - the caller's role in the workspace
 * @param isPending - disables the controls while a change to this row is in flight
 * @param onChangeRole - gives the member a new role
 * @param onRemove - removes the member
 */
const WorkspaceMemberRow = ({
    member,
    isSelf,
    callerRole,
    isPending,
    onChangeRole,
    onRemove,
}: {
    member: WorkspaceMemberDto;
    isSelf: boolean;
    callerRole: WorkspaceRole;
    isPending: boolean;
    onChangeRole: (role: WorkspaceRole) => void;
    onRemove: () => void;
}) => {
    const isOwnerRow = member.role === "owner";
    const canChangeRole = !isSelf && !isOwnerRow && callerRole === "owner"; // only the owner promotes or demotes
    const canRemove =
        !isSelf &&
        !isOwnerRow &&
        (callerRole === "owner" ||
            (callerRole === "admin" && member.role === "member")); // admins may remove plain members only

    return (
        <PersonRow
            name={member.name}
            isSelf={isSelf}
            avatarUrl={member.avatarUrl}
            colorKey={member.email}
            subtitle={member.email}
        >
            {isOwnerRow ? (
                <span className="flex items-center gap-1.5 pr-1 text-sm text-fg-secondary sm:pr-11">
                    <LuLock className="h-3.5 w-3.5" />
                    Owner
                </span>
            ) : (
                <div className="flex items-center gap-1">
                    {canChangeRole ? (
                        <Select
                            variant="outline"
                            value={member.role}
                            options={ROLE_OPTIONS}
                            onChange={onChangeRole}
                            disabled={isPending}
                            className="w-[6.5rem] sm:w-[7.5rem]"
                        />
                    ) : (
                        <span className="px-2 text-sm text-fg-secondary">
                            {ROLE_LABELS[member.role]}
                        </span>
                    )}
                    {canRemove ? (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onRemove}
                            disabled={isPending}
                            aria-label={`Remove ${member.name}`}
                        >
                            <LuX />
                        </Button>
                    ) : (
                        <span className="hidden w-7 sm:block" />
                    )}
                </div>
            )}
        </PersonRow>
    );
};

export default WorkspaceMemberRow;
