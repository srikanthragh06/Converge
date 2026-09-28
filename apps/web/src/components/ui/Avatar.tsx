import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * Round user avatar: the profile image when one exists, otherwise the name's
 * first letter. Defaults to 24px; pass size/text classes via className.
 * Extra div props (including ref) are forwarded, so it can be a Tooltip trigger.
 * @param name - the user's display name, used for the initial and image alt text
 * @param src - profile image URL, or null/undefined to show the initial
 * @param ringColor - optional 2px border color, e.g. a collaborator's presence color
 */
export const Avatar = ({
    name,
    src,
    ringColor,
    className,
    style,
    ...rest
}: {
    name: string;
    src?: string | null;
    ringColor?: string;
} & ComponentProps<"div">) => (
    <div
        className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-selected text-xs font-medium text-fg-secondary",
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
            (name[0]?.toUpperCase() ?? "?")
        )}
    </div>
);

/**
 * Overlapping row of Avatars, each separated from the next by a ring in the
 * page surface color. Extra div props (including ref) are forwarded, so the
 * whole group can be a Tooltip trigger.
 */
export const AvatarGroup = ({
    className,
    children,
    ...rest
}: ComponentProps<"div">) => (
    <div
        className={cn(
            "flex -space-x-2 [&>*]:ring-2 [&>*]:ring-surface",
            className,
        )}
        {...rest}
    >
        {children}
    </div>
);
