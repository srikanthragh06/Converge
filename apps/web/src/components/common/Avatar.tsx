import type { ComponentProps } from "react";
import { cn, getAvatarColor } from "@/lib/utils";

/**
 * Up to two initials from a name: first and last word ("Priya Kumar" → "PK"),
 * or just the first letter for a single word.
 * @param name - the display name
 */
const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (first + last).toUpperCase();
};

/**
 * Round user avatar: the profile image when one exists, otherwise the name's
 * initials on a color chosen from the name. Defaults to 24px; pass size/text
 * classes via className. Extra div props (including ref) are forwarded, so it
 * can be a Tooltip trigger.
 * @param name - the user's display name, used for the initials and image alt text
 * @param src - profile image URL, or null/undefined to show initials
 * @param label - text shown instead of initials on a neutral fill, e.g. "+3" for an overflow count
 * @param colorKey - stable key for the initials color (default: name), e.g. a user id
 * @param ringColor - optional 2px border color, e.g. a collaborator's presence color
 */
export const Avatar = ({
    name,
    src,
    label,
    colorKey,
    ringColor,
    className,
    style,
    ...rest
}: {
    name: string;
    src?: string | null;
    label?: string;
    colorKey?: string;
    ringColor?: string;
} & Omit<ComponentProps<"div">, "children">) => (
    <div
        className={cn(
            "flex h-6 w-6 shrink-0 select-none items-center justify-center overflow-hidden rounded-full text-[10px] font-medium",
            label || src
                ? "bg-surface-selected text-fg-secondary"
                : cn(getAvatarColor(colorKey ?? name), "text-avatar-fg"),
            className,
        )}
        style={
            ringColor ? { border: `2px solid ${ringColor}`, ...style } : style
        }
        {...rest}
    >
        {src ? (
            <img
                src={src}
                referrerPolicy="no-referrer"
                alt={name}
                className="h-full w-full object-cover"
            />
        ) : (
            (label ?? getInitials(name))
        )}
    </div>
);

/**
 * Overlapping row of Avatars, each separated from the next by a ring in the
 * page surface color. Extra div props (including ref) are forwarded, so the
 * whole group can be a Tooltip trigger.
 * @param ringClassName - ring color class matching the background the group
 *                        sits on (default the page surface), e.g. "[&>*]:ring-surface-elevated" in a modal
 */
export const AvatarGroup = ({
    ringClassName = "[&>*]:ring-surface",
    className,
    children,
    ...rest
}: { ringClassName?: string } & ComponentProps<"div">) => (
    <div
        className={cn(
            "flex -space-x-1.5 [&>*]:ring-2",
            ringClassName,
            className,
        )}
        {...rest}
    >
        {children}
    </div>
);
