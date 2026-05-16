import { AiOutlineLoading3Quarters } from "react-icons/ai";
import useAccessOverridesTab from "../../../../hooks/useAccessOverridesTab";
import RoleOverrideRow from "./RoleOverrideRow";
import DocumentUserAccessCard from "../../../../components/DocumentUserAccessCard";

/**
 * Access Overrides tab content for ManageDocumentModal. Two sections:
 * 1. Role overrides — per-role dropdowns (Admin / Member / Non-member) with a
 *    null "Default" option that resets the role to the workspace-level default.
 * 2. User overrides — email-driven add/search with an infinite-scroll list of
 *    existing per-user access entries, each showing the user's fallback level.
 */
const AccessOverridesTab = ({
    documentId,
}: {
    /** ID of the document being managed. */
    documentId: string | undefined;
}) => {
    const {
        documentAccess,
        isAccessLoading,
        roleOverrides,
        isRoleOverridesLoading,
        isSavingRole,
        updateRoleOverride,
        canManage,
        email,
        setEmail,
        existingUsers,
        setExistingUsers,
        foundUser,
        setFoundUser,
        isExistingUsersLoading,
        isFetchingMore,
        isFindNewUserLoading,
        isFindNewUserConflict,
        sentinelRef,
    } = useAccessOverridesTab({ documentId });

    return (
        <div className="h-full flex flex-col">
            {/* ── Section 1: Role Overrides ─────────────────────────── */}
            {isRoleOverridesLoading || isAccessLoading ? (
                <AiOutlineLoading3Quarters className="animate-spin mb-4 shrink-0" />
            ) : roleOverrides ? (
                <div className="shrink-0">
                    <p className="text-xs opacity-50 mb-1">
                        Role Overrides · {roleOverrides.workspaceName}
                    </p>
                    <RoleOverrideRow
                        label="Admin"
                        value={roleOverrides.adminDocAccess}
                        workspaceDefault={roleOverrides.workspaceAdminDocAccess}
                        disabled={!canManage}
                        isSaving={isSavingRole}
                        onUpdate={(v) =>
                            updateRoleOverride("adminDocAccess", v)
                        }
                    />
                    <RoleOverrideRow
                        label="Member"
                        value={roleOverrides.memberDocAccess}
                        workspaceDefault={
                            roleOverrides.workspaceMemberDocAccess
                        }
                        disabled={!canManage}
                        isSaving={isSavingRole}
                        onUpdate={(v) =>
                            updateRoleOverride("memberDocAccess", v)
                        }
                    />
                    <RoleOverrideRow
                        label="Non-member"
                        value={roleOverrides.nonMemberDocAccess}
                        workspaceDefault={
                            roleOverrides.workspaceNonMemberDocAccess
                        }
                        disabled={!canManage}
                        isSaving={isSavingRole}
                        onUpdate={(v) =>
                            updateRoleOverride("nonMemberDocAccess", v)
                        }
                    />
                </div>
            ) : null}

            {/* Divider between role and user sections */}
            <div className="h-[1px] bg-background-elevated shrink-0 my-3 sm:my-4" />

            {/* ── Section 2: User Overrides ──────────────────────────── */}
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={canManage ? "Add access by email" : "Search users"}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-background-elevated
                text-sm text-white focus:outline-none border-none shrink-0"
            />

            {canManage && isFindNewUserLoading && (
                <AiOutlineLoading3Quarters className="animate-spin mt-3 sm:mt-4 shrink-0" />
            )}
            {canManage &&
                !isFindNewUserLoading &&
                isFindNewUserConflict &&
                email.trim().length > 0 && (
                    <div className="opacity-50 w-full bg-background-overlay px-2 py-1 rounded-lg text-xs mt-3 sm:mt-4 shrink-0">
                        {email} is already the owner or has access assigned.
                    </div>
                )}
            {canManage &&
                !isFindNewUserLoading &&
                !isFindNewUserConflict &&
                !foundUser &&
                email.trim().length > 0 && (
                    <div className="opacity-50 w-full bg-background-overlay px-2 py-1 rounded-lg text-xs mt-3 sm:mt-4 shrink-0">
                        Enter the exact email address of the person you want to
                        share access with.
                    </div>
                )}
            {canManage && !isFindNewUserLoading && foundUser && (
                <div className="mt-3 sm:mt-4 shrink-0">
                    <p className="text-xs opacity-50 mb-2">Add User</p>
                    <DocumentUserAccessCard
                        avatarUrl={foundUser.avatarUrl}
                        documentId={documentId}
                        userId={foundUser.id}
                        email={foundUser.email}
                        name={foundUser.name}
                        fallbackAccess={foundUser.fallbackAccess}
                        documentAccess={documentAccess ?? "noAccess"}
                        onAccessChanged={(newAccess) => {
                            setFoundUser(null);
                            setExistingUsers((users) => [
                                { ...foundUser, access: newAccess },
                                ...users,
                            ]);
                        }}
                    />
                </div>
            )}

            {/* Existing user overrides — scrollable with infinite scroll */}
            <div className="mt-3 sm:mt-4 flex flex-col flex-1 min-h-0">
                <p className="text-xs opacity-50 mb-2 shrink-0">
                    Existing Overrides
                </p>
                {isExistingUsersLoading ? (
                    <AiOutlineLoading3Quarters className="animate-spin mt-2" />
                ) : (
                    <div
                        className="flex flex-col flex-1 min-h-0 overflow-y-auto"
                        style={{ scrollbarWidth: "thin" }}
                    >
                        {existingUsers.map((user) => (
                            <DocumentUserAccessCard
                                key={user.id}
                                avatarUrl={user.avatarUrl}
                                documentId={documentId}
                                access={user.access}
                                userId={user.id}
                                email={user.email}
                                name={user.name}
                                fallbackAccess={user.fallbackAccess}
                                documentAccess={documentAccess ?? "noAccess"}
                                canDeleteAccess={canManage}
                                onAccessRemoved={() => {
                                    setExistingUsers((users) =>
                                        users.filter((u) => u.id !== user.id),
                                    );
                                }}
                                onAccessChanged={(newAccess) => {
                                    setExistingUsers((users) =>
                                        users.map((u) =>
                                            u.id === user.id
                                                ? { ...u, access: newAccess }
                                                : u,
                                        ),
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

export default AccessOverridesTab;
