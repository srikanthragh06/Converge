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
 * @param side - which side of the trigger to open on (default "bottom")
 * @param children - the trigger; must be a single element that accepts a ref
 *                   and event props (a DOM element or a component that forwards them)
 */
const Tooltip = ({
    content,
    side = "bottom",
    children,
}: {
    content: ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    children: ReactElement;
}) => (
    <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
                side={side}
                sideOffset={6}
                collisionPadding={8}
                className="z-[70] max-w-xs rounded-md bg-tooltip px-2 py-1 text-xs text-tooltip-fg shadow-md"
            >
                {content}
            </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
);

export default Tooltip;
