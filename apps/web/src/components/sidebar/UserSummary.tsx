import type { AuthResponseDto } from "@converge/shared";
import { Avatar } from "../ui/Avatar";

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

export default UserSummary;
