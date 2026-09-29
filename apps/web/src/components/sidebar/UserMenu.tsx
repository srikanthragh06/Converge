import { LuChevronsUpDown, LuLogOut } from "react-icons/lu";
import type { AuthResponseDto } from "@converge/shared";
import useLogout from "../../hooks/useLogout";
import { Avatar } from "../ui/Avatar";
import { DropdownMenu } from "../ui/Menu";

/**
 * Avatar, name, and email of the signed-in user, in a row.
 * @param user - the signed-in user
 */
const UserSummary = ({ user }: { user: AuthResponseDto }) => (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <Avatar
            name={user.name}
            src={user.avatarUrl}
            colorKey={user.id}
            className="h-7 w-7 text-[11px]"
        />
        <span className="flex min-w-0 flex-1 flex-col text-left">
            <span className="truncate text-[13px] font-medium text-fg">
                {user.name}
            </span>
            <span className="truncate text-xs text-fg-muted">{user.email}</span>
        </span>
    </span>
);

/**
 * The sidebar footer: the signed-in user, opening a menu above it with
 * their profile and Log out.
 * @param user - the signed-in user
 */
const UserMenu = ({ user }: { user: AuthResponseDto }) => {
    const logout = useLogout(); // clears the session and redirects to /

    return (
        <DropdownMenu
            side="top"
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)] max-w-none"
            items={[
                {
                    type: "label",
                    label: (
                        <span className="flex py-1">
                            <UserSummary user={user} />
                        </span>
                    ),
                },
                { type: "separator" },
                { label: "Log out", icon: <LuLogOut />, onSelect: logout },
            ]}
            trigger={
                <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-1.5 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-gold/60 data-[state=open]:bg-surface-hover"
                >
                    <UserSummary user={user} />
                    <LuChevronsUpDown className="h-4 w-4 shrink-0 text-fg-muted" />
                </button>
            }
        />
    );
};

export default UserMenu;
