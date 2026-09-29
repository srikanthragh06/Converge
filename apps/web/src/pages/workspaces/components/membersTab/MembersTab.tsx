import { useAtomValue } from "jotai";
import { LuUserPlus } from "react-icons/lu";
import type { WorkspaceRole } from "@converge/shared";
import { authAtom } from "../../../../atoms/auth";
import useMembersTab from "../../../../hooks/useMembersTab";
import Input from "../../../../components/ui/Input";
import Skeleton from "../../../../components/ui/Skeleton";
import DelayedRender from "../../../../components/DelayedRender";
import type { SelectOption } from "../../../../components/ui/Select";
import AddPersonCard from "../../../../components/people/AddPersonCard";
import EmailNotice from "../../../../components/people/EmailNotice";
import WorkspaceMemberRow from "./WorkspaceMemberRow";

/**
 * Members tab of workspace settings (pp 19 / 26). Admins and the owner add
 * people by full email: the person found shows in a card with a role
 * dropdown and Add. Everyone can filter the list with the same field. The
 * list pages in as it scrolls.
 * @param workspaceId - the workspace being configured
 * @param role - the caller's role, or null while it loads
 * @param membersCount - total member count for the list header, or null while loading
 * @param onMembersChanged - called after a member is added or removed
 */
const MembersTab = ({
    workspaceId,
    role,
    membersCount,
    onMembersChanged,
}: {
    workspaceId: number;
    role: WorkspaceRole | null;
    membersCount: number | null;
    onMembersChanged: () => void;
}) => {
    const {
        email,
        setEmail,
        members,
        lookup,
        isMembersLoading,
        isFetchingMore,
        isAdding,
        pendingUserId,
        sentinelRef,
        canManage,
        addMember,
        changeRole,
        removeMember,
    } = useMembersTab({ workspaceId, role, onMembersChanged });
    const userEmail = useAtomValue(authAtom).user?.email; // marks the caller's own row

    if (role === null)
        return (
            <DelayedRender>
                <div className="flex flex-col gap-3">
                    <Skeleton height="2.75rem" />
                    <Skeleton height="1rem" width="30%" className="mt-4" />
                    <Skeleton height="2.5rem" />
                    <Skeleton height="2.5rem" />
                    <Skeleton height="2.5rem" />
                </div>
            </DelayedRender>
        );

    // Roles the caller may give a new member: admins can't make admins.
    const addOptions: SelectOption<WorkspaceRole>[] =
        role === "owner"
            ? [
                  { label: "Member", value: "member" },
                  { label: "Admin", value: "admin" },
              ]
            : [{ label: "Member", value: "member" }];

    return (
        <div className="flex flex-col">
            <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                    canManage
                        ? "Add people by email"
                        : "Filter members by email"
                }
                aria-label={
                    canManage
                        ? "Add people by email"
                        : "Filter members by email"
                }
                icon={<LuUserPlus />}
                inputSize="lg"
            />
            {lookup.status === "loading" && (
                <DelayedRender>
                    <Skeleton height="3.75rem" className="mt-2" />
                </DelayedRender>
            )}
            {lookup.status === "found" && (
                <>
                    <div className="mt-2">
                        <AddPersonCard
                            key={lookup.user.id}
                            user={lookup.user}
                            subtitle={`${lookup.user.email} · not in this workspace yet`}
                            options={addOptions}
                            defaultValue="member"
                            isAdding={isAdding}
                            onAdd={addMember}
                        />
                    </div>
                    <p className="mt-2 text-xs text-fg-muted">
                        Choose their role, then Add. It applies immediately.
                    </p>
                </>
            )}
            {lookup.status === "notFound" && (
                <EmailNotice title="No Converge account with this email">
                    Check the spelling. They need to sign in to Converge once
                    before you can add them.
                </EmailNotice>
            )}
            {lookup.status === "isMember" && (
                <EmailNotice title="Already in this workspace">
                    They're in the list below.
                </EmailNotice>
            )}

            <div className="mb-1 mt-6 flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-fg">
                    {membersCount !== null &&
                        `${membersCount} ${membersCount === 1 ? "member" : "members"}`}
                </span>
                <span className="hidden text-xs text-fg-muted sm:block">
                    Roles: Owner, Admin, Member
                </span>
            </div>
            {isMembersLoading ? (
                <DelayedRender>
                    <div className="flex flex-col gap-3 py-1.5">
                        <Skeleton height="2.5rem" />
                        <Skeleton height="2.5rem" />
                        <Skeleton height="2.5rem" />
                    </div>
                </DelayedRender>
            ) : (
                <div className="flex flex-col divide-y divide-line-subtle">
                    {members.map((member) => (
                        <div key={member.id} className="py-1.5">
                            <WorkspaceMemberRow
                                member={member}
                                isSelf={member.email === userEmail}
                                callerRole={role}
                                isPending={pendingUserId === member.id}
                                onChangeRole={(r) => changeRole(member, r)}
                                onRemove={() => removeMember(member)}
                            />
                        </div>
                    ))}
                    {members.length === 0 && (
                        <p className="py-6 text-center text-sm text-fg-muted">
                            No members match this email.
                        </p>
                    )}
                </div>
            )}
            {/* Observed to load the next page of members */}
            <div ref={sentinelRef} className="h-px" />
            {isFetchingMore && (
                <DelayedRender>
                    <div className="flex flex-col gap-3 py-1.5">
                        <Skeleton height="2.5rem" />
                        <Skeleton height="2.5rem" />
                    </div>
                </DelayedRender>
            )}
        </div>
    );
};

export default MembersTab;
