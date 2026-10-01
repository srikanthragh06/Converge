import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One full-width row in the sidebar's navigation lists: a muted icon, a
 * label, and an optional keyboard hint at the right edge. Extra button props
 * (including ref) are forwarded, so it can be a menu or tooltip trigger.
 * @param icon - leading icon, e.g. `<LuSearch />`
 * @param label - row text
 * @param shortcut - keyboard hint, e.g. `formatShortcut("K")`
 * @param active - shows the selected fill, for the page currently open
 */
const SidebarNavItem = ({
    icon,
    label,
    shortcut,
    active,
    className,
    ...rest
}: {
    icon: ReactNode;
    label: ReactNode;
    shortcut?: string;
    active?: boolean;
} & ComponentProps<"button">) => (
    <button
        type="button"
        aria-current={active ? "page" : undefined}
        className={cn(
            "flex h-8 w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-fg outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-gold/60 disabled:pointer-events-none disabled:opacity-50",
            active && "bg-surface-selected hover:bg-surface-selected",
            className,
        )}
        {...rest}
    >
        <span className="flex shrink-0 text-fg-muted [&_svg]:h-4 [&_svg]:w-4">
            {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {shortcut && (
            <kbd className="shrink-0 font-sans text-xs text-fg-muted">
                {shortcut}
            </kbd>
        )}
    </button>
);

export default SidebarNavItem;
