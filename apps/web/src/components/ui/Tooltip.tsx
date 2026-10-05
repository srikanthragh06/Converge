import type { ReactElement, ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

/**
 * Makes every Tooltip in the app share one open/close delay. Mount once, at the app root.
 */
export const TooltipProvider = ({ children }: { children: ReactNode }) => (
    <TooltipPrimitive.Provider delayDuration={300}>
        {children}
    </TooltipPrimitive.Provider>
);

/**
 * Small inverted chip shown on hover or keyboard focus of its trigger.
 * Rendered in a portal, so it is never clipped by a scrolling parent.
 * @param content - what the tooltip shows (plain text or rich content)
 * @param shortcut - keyboard hint shown dimmed after the content, e.g.
 *                   `formatShortcut("J")` from lib/utils
 * @param side - which side of the trigger to open on (default "bottom")
 * @param children - the trigger; must be a single element that accepts a ref
 *                   and event props (a DOM element or a component that forwards them)
 * @param open - controls visibility, for a caller that must veto some opens; leave unset otherwise
 * @param onOpenChange - called when the tooltip wants to open or close; pair with open
 */
const Tooltip = ({
    content,
    shortcut,
    side = "bottom",
    children,
    open,
    onOpenChange,
}: {
    content: ReactNode;
    shortcut?: string;
    side?: "top" | "right" | "bottom" | "left";
    children: ReactElement;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) => (
    <TooltipPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
                side={side}
                sideOffset={6}
                collisionPadding={8}
                className="z-[70] flex max-w-xs animate-fade-in items-center gap-2 rounded-md bg-tooltip px-2 py-1 text-xs font-medium text-tooltip-fg shadow-md shadow-shadow"
            >
                <span className="min-w-0 break-words">{content}</span>
                {shortcut && (
                    <kbd className="shrink-0 font-sans font-normal text-tooltip-fg/60">
                        {shortcut}
                    </kbd>
                )}
            </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
);

export default Tooltip;
