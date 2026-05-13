import { AiOutlineLoading3Quarters } from "react-icons/ai";
import useMembersTab from "../../../../hooks/useMembersTab";
import WorkspaceMemberCard from "./WorkspaceMemberCard";

/**
 * Members tab content for WorkspaceConfigModal. Displays and manages
 * workspace members. Members can view the list. Admins can add and remove
 * members. Owners can change roles and remove anyone.
 */
const MembersTab = ({ workspaceId }: { workspaceId: number }) => {
    const {
        email,
        setEmail,
        members,
        setMembers,
        foundUser,
        setFoundUser,
        isMembersLoading,
        isFetchingMore,
        isFindNewUserLoading,
        isFindNewUserConflict,
        isRoleLoading,
        sentinelRef,
        currentUserRole,
        canManage,
    } = useMembersTab({ workspaceId });

    if (isRoleLoading || currentUserRole === null) {
        return (
            <div className="h-full flex items-center justify-center">
                <AiOutlineLoading3Quarters className="animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="text-base sm:text-xl mb-3 sm:mb-6">Members</div>

            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                    canManage ? "Add member by email" : "Search members"
                }
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-background-elevated
                text-sm text-white focus:outline-none border-none"
            />

            {canManage && isFindNewUserLoading && (
                <AiOutlineLoading3Quarters className="animate-spin mt-3 sm:mt-4" />
            )}
            {canManage &&
                !isFindNewUserLoading &&
                isFindNewUserConflict &&
                email.trim().length > 0 && (
                    <div
                        className="opacity-50 w-full bg-background-overlay px-2 py-1
                        rounded-lg text-xs mt-3 sm:mt-4"
                    >
                        {email} is already the owner or a member of this
                        workspace.
                    </div>
                )}
            {canManage &&
                !isFindNewUserLoading &&
                !isFindNewUserConflict &&
                !foundUser &&
                email.trim().length > 0 && (
                    <div
                        className="opacity-50 w-full bg-background-overlay px-2 py-1
                        rounded-lg text-xs mt-3 sm:mt-4"
                    >
                        Enter the exact email address of the person you want to
                        invite.
                    </div>
                )}
            {canManage && !isFindNewUserLoading && foundUser && (
                <div className="mt-3 sm:mt-4 shrink-0">
                    <p className="text-xs opacity-50 mb-2">Add Member</p>
                    {/* Found user card — posting a role creates the membership and moves this user to the existing list */}
                    <WorkspaceMemberCard
                        avatarUrl={foundUser.avatarUrl}
                        workspaceId={workspaceId}
                        userId={foundUser.id}
                        email={foundUser.email}
                        name={foundUser.name}
                        currentUserRole={currentUserRole}
                        onRoleChanged={(newRole) => {
                            setFoundUser(null);
                            setMembers((prev) => [
                                {
                                    id: foundUser.id,
                                    name: foundUser.name,
                                    email: foundUser.email,
                                    avatarUrl: foundUser.avatarUrl,
                                    role: newRole,
                                },
                                ...prev,
                            ]);
                        }}
                    />
                </div>
            )}

            {/* Existing members — flex-1 + min-h-0 lets this section shrink and activate overflow-y-auto */}
            <div className="mt-3 sm:mt-4 flex flex-col flex-1 min-h-0">
                <p className="text-xs opacity-50 mb-2 shrink-0">
                    Existing Members
                </p>
                {isMembersLoading ? (
                    <AiOutlineLoading3Quarters className="animate-spin mt-2" />
                ) : (
                    <div
                        className="flex flex-col flex-1 min-h-0 overflow-y-auto"
                        style={{ scrollbarWidth: "thin" }}
                    >
                        {members.map((member) => (
                            <WorkspaceMemberCard
                                key={member.id}
                                avatarUrl={member.avatarUrl}
                                workspaceId={workspaceId}
                                userId={member.id}
                                email={member.email}
                                name={member.name}
                                role={member.role}
                                currentUserRole={currentUserRole}
                                type={
                                    member.role === "owner" ? "owner" : "member"
                                }
                                onRoleChanged={(newRole) => {
                                    setMembers((prev) =>
                                        prev.map((m) =>
                                            m.id === member.id
                                                ? { ...m, role: newRole }
                                                : m,
                                        ),
                                    );
                                }}
                                onMemberRemoved={() => {
                                    setMembers((prev) =>
                                        prev.filter((m) => m.id !== member.id),
                                    );
                                }}
                            />
                        ))}
                        {/* Sentinel observed by IntersectionObserver to trigger the next page load */}
                        <div
                            ref={sentinelRef}
                            className="border-2 border-solid border-transparent"
                        />
                        {isFetchingMore && (
                            <AiOutlineLoading3Quarters className="animate-spin mx-auto mt-2 mb-1" />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MembersTab;
