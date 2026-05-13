import { useState } from "react";
import { RxAvatar } from "react-icons/rx";
import { type WorkspaceRole } from "@converge/shared";
import { Dropdown } from "primereact/dropdown";
import "primereact/resources/themes/lara-dark-blue/theme.css";
import apiClient from "../../../../lib/http";
import { useAtomValue } from "jotai";
import { authAtom } from "../../../../atoms/auth";

interface RoleOption {
    label: string;
    value: WorkspaceRole | "__remove__";
}

const ROLE_LABELS: Record<WorkspaceRole, string> = {
    member: "Member",
    admin: "Admin",
    owner: "Owner",
};

const REMOVE_OPTION: RoleOption = { label: "Remove", value: "__remove__" };

/**
 * Card displaying a single workspace member. Shows avatar, name, email, and a
 * role dropdown on the right.
 *
 * Interaction rules:
 * - Members cannot edit anyone's role.
 * - Admins can remove members (but not change roles or touch admins/owner).
 * - Owners can change roles and remove anyone (except themselves).
 */
const WorkspaceMemberCard = ({
    avatarUrl,
    name,
    email,
    userId,
    workspaceId,
    role,
    currentUserRole,
    onRoleChanged,
    onMemberRemoved,
    type = "member",
}: {
    avatarUrl: string | null;
    name: string;
    email: string;
    userId: number;
    workspaceId: number;
    /** Current role if the user is already a member; undefined for a new (found) user being invited. */
    role?: WorkspaceRole;
    currentUserRole: WorkspaceRole;
    onRoleChanged?: (newRole: WorkspaceRole) => void;
    onMemberRemoved?: () => void;
    type?: "member" | "owner" | "none";
}) => {
    const [isLoading, setIsLoading] = useState(false); // true while a role change or removal request is in flight
    const currentUserId = useAtomValue(authAtom).user?.id;

    // Auth user id is a string from Google; workspace member ids are numeric.
    const isSelf =
        currentUserId !== undefined && Number(currentUserId) === userId;

    // New users (role undefined) are always interactive. For existing members:
    // members cannot interact, admins can only interact with members (not admins or owner),
    // owners can interact with everyone except themselves.
    const canInteract =
        role === undefined ||
        (!isSelf &&
            currentUserRole !== "member" &&
            (currentUserRole === "owner" || role === "member"));

    /**
     * Builds the dropdown option list based on whether the user is new or existing,
     * the current user's role, and whether the card is interactive.
     */
    const buildOptions = (): RoleOption[] => {
        // New user (not yet a member): show assignable roles, no Remove option.
        if (role === undefined) {
            const opts: RoleOption[] = [{ label: "Member", value: "member" }];
            if (currentUserRole === "owner") {
                opts.push({ label: "Admin", value: "admin" });
            }
            return opts;
        }

        // Existing member, cannot interact: show current role only.
        if (!canInteract) return [{ label: ROLE_LABELS[role], value: role }];

        // Existing member, owner can do anything.
        if (currentUserRole === "owner") {
            return [
                { label: "Admin", value: "admin" },
                { label: "Member", value: "member" },
                REMOVE_OPTION,
            ];
        }

        // Admin viewing a member — can only remove, not promote.
        return [{ label: "Member", value: "member" }, REMOVE_OPTION];
    };

    const options = buildOptions();

    /**
     * Handles dropdown selection. Calls POST to add or update the member's role,
     * or DELETE to remove them. Disables the dropdown for the duration of the
     * request to prevent double-submission.
     */
    const handleChange = async (newValue: WorkspaceRole | "__remove__") => {
        if (!workspaceId) return;
        if (role !== undefined && !canInteract) return;

        setIsLoading(true);
        try {
            if (newValue === "__remove__") {
                await apiClient.delete(
                    `/workspaces/${workspaceId}/members/${userId}`,
                );
                onMemberRemoved?.();
            } else if (newValue !== role) {
                await apiClient.post(`/workspaces/${workspaceId}/members`, {
                    email,
                    role: newValue,
                });
                onRoleChanged?.(newValue);
            }
        } catch (err) {
            console.error("WorkspaceMemberCard: operation failed:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2">
            {/* Avatar — shows the user's profile picture or a generic fallback icon */}
            {avatarUrl ? (
                <img
                    referrerPolicy="no-referrer"
                    src={avatarUrl}
                    alt={name}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0"
                />
            ) : (
                <RxAvatar className="w-7 h-7 sm:w-8 sm:h-8 text-text-secondary shrink-0" />
            )}
            {/* Name and email stacked vertically */}
            <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs sm:text-sm text-text-primary truncate">
                    {name}
                </span>
                <span className="text-xs text-text-secondary truncate">
                    {email}
                </span>
            </div>
            {type === "owner" && (
                <span className="shrink-0 text-xs sm:text-sm text-text-secondary opacity-50 px-1.5 sm:px-2 py-0.5 sm:py-1">
                    Owner
                </span>
            )}
            {type === "member" && options.length > 0 && (
                <Dropdown
                    value={role ?? null}
                    options={options}
                    onChange={(e) => handleChange(e.value)}
                    disabled={(role !== undefined && !canInteract) || isLoading}
                    placeholder="Select role"
                    className="shrink-0 text-xs sm:text-sm"
                    pt={{
                        root: {
                            className:
                                "border-none bg-transparent focus:outline-none",
                        },
                        input: {
                            className:
                                "text-xs sm:text-sm text-white py-0.5 sm:py-1 px-1.5 sm:px-2",
                        },
                        trigger: {
                            className: !canInteract ? "hidden" : "text-white",
                        },
                        panel: {
                            className:
                                "bg-background-base border border-gray-700",
                        },
                        item: {
                            className:
                                "text-xs sm:text-sm text-white hover:bg-background-elevated px-2 sm:px-3 py-1.5 sm:py-2",
                        },
                    }}
                />
            )}
        </div>
    );
};

export default WorkspaceMemberCard;
