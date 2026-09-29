import type { ReactNode } from "react";
import { Avatar } from "../../../components/ui/Avatar";

/**
 * One person in the Share dialog: avatar, name, and a muted subtitle on the
 * left, with their access control (or a read-only label) on the right.
 * @param name - display name, e.g. "Priya K."
 * @param isSelf - appends "(you)" to the name, for the caller's own row
 * @param avatarUrl - profile image URL, or null for initials
 * @param colorKey - stable key for the initials color, e.g. the email
 * @param subtitle - muted second line, e.g. "priya@example.com · direct access"
 * @param children - the access control on the right
 */
const SharePersonRow = ({
    name,
    isSelf = false,
    avatarUrl,
    colorKey,
    subtitle,
    children,
}: {
    name: string;
    isSelf?: boolean;
    avatarUrl: string | null;
    colorKey: string;
    subtitle: ReactNode;
    children?: ReactNode;
}) => (
    <div className="flex items-center gap-3 py-1.5">
        <Avatar
            name={name}
            src={avatarUrl}
            colorKey={colorKey}
            className="h-8 w-8 text-xs"
        />
        <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm text-fg">
                {isSelf ? `${name} (you)` : name}
            </span>
            <span className="truncate text-xs text-fg-muted">{subtitle}</span>
        </div>
        {children}
    </div>
);

/**
 * Read-only access label in place of a dropdown, e.g. the owner's "Owner"
 * or a level the caller may not change.
 * @param icon - optional leading icon, e.g. a lock for the owner
 * @param children - the label
 */
export const ReadOnlyAccess = ({
    icon,
    children,
}: {
    icon?: ReactNode;
    children: ReactNode;
}) => (
    <span className="flex shrink-0 items-center gap-1.5 px-3 text-sm text-fg-secondary [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
        {children}
    </span>
);

export default SharePersonRow;
