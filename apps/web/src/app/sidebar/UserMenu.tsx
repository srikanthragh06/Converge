import { LuChevronsUpDown, LuLogOut } from "react-icons/lu";
import type { AuthResponseDto } from "@converge/shared";
import useLogout from "@/features/auth/hooks/useLogout";
import { Avatar } from "@/components/common/Avatar";
import { DropdownMenu } from "@/components/ui/Menu";
import UserSummary from "./UserSummary";

/**
 * The sidebar footer: the signed-in user, opening a menu above it with
 * their profile and Log out.
 * @param user - the signed-in user
 * @param compact - shows only the avatar and opens the menu to the right,
 *                  for the collapsed icon rail
 */
const UserMenu = ({
    user,
    compact = false,
}: {
    user: AuthResponseDto;
    compact?: boolean;
}) => {
    const logout = useLogout(); // clears the session and redirects to /

    return (
        <DropdownMenu
            side={compact ? "right" : "top"}
            align={compact ? "end" : "start"}
            className={
                compact
                    ? "w-64"
                    : "w-[var(--radix-dropdown-menu-trigger-width)] max-w-none"
            }
            tooltip={compact ? user.name : undefined}
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
                compact ? (
                    <button
                        type="button"
                        aria-label="Account"
                        className="flex cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                    >
                        <Avatar
                            name={user.name}
                            src={user.avatarUrl}
                            colorKey={user.id}
                            className="h-8 w-8 text-[11px]"
                        />
                    </button>
                ) : (
                    <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-1.5 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-gold/60 data-[state=open]:bg-surface-hover"
                    >
                        <UserSummary user={user} />
                        <LuChevronsUpDown className="h-4 w-4 shrink-0 text-fg-muted" />
                    </button>
                )
            }
        />
    );
};

export default UserMenu;
