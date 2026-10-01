import type { ReactNode } from "react";
import { Avatar } from "@/components/common/Avatar";

/**
 * One person in a people list (Share dialog, workspace Members): avatar,
 * name, and a muted subtitle on the left, with their access or role control
 * (or a read-only label) on the right.
 * @param name - display name, e.g. "Priya K."
 * @param isSelf - the caller's own row: "Name (you)", or just "You" on phones (pp 80 / 86)
 * @param avatarUrl - profile image URL, or null for initials
 * @param colorKey - stable key for the initials color, e.g. the email
 * @param subtitle - muted second line, e.g. "priya@example.com · direct access"
 * @param children - the access control on the right
 */
const PersonRow = ({
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
                {isSelf ? (
                    <>
                        <span className="sm:hidden">You</span>
                        <span className="hidden sm:inline">{name} (you)</span>
                    </>
                ) : (
                    name
                )}
            </span>
            <span className="truncate text-xs text-fg-muted">{subtitle}</span>
        </div>
        {children}
    </div>
);

export default PersonRow;
