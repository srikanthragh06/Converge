import type { WorkspaceType } from "@converge/shared";
import { cn, getAvatarColor, WORKSPACE_TILE_COLORS } from "../../lib/utils";

/**
 * Rounded square showing a workspace's first letter in the display serif:
 * gold for the user's personal workspace; shared (custom) ones get a stable
 * color picked from the name, so each is told apart at a glance.
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
                ? cn(
                      getAvatarColor(name, WORKSPACE_TILE_COLORS),
                      "text-avatar-fg",
                  )
                : "bg-gold text-gold-fg",
            className,
        )}
    >
        {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
);

export default WorkspaceTile;
