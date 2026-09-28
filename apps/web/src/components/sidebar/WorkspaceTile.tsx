import type { WorkspaceType } from "@converge/shared";
import { cn } from "../../lib/utils";

/**
 * Rounded square showing a workspace's first letter in the display serif:
 * gold for the user's personal workspace, blue for shared (custom) ones.
 * @param name - the workspace name; its first character is shown
 * @param type - "personal" or "custom", which picks the fill
 * @param className - size overrides (default 28px)
 */
const WorkspaceTile = ({
    name,
    type,
    className,
}: {
    name: string;
    type: WorkspaceType | undefined;
    className?: string;
}) => (
    <span
        aria-hidden
        className={cn(
            "flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-md font-serif text-base font-medium",
            type === "custom"
                ? "bg-avatar-3 text-avatar-fg"
                : "bg-gold text-gold-fg",
            className,
        )}
    >
        {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
);

export default WorkspaceTile;
