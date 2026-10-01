import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LuX } from "react-icons/lu";
import { cn } from "@/lib/utils";
import type { MenuEntry } from "./Menu";

/** How far (px) the sheet must be dragged down before releasing closes it. */
const DISMISS_DISTANCE_PX = 100;

/**
 * Phone-sized panel that slides up from the bottom of the screen over a
 * dimmed backdrop, with a drag handle, serif title, and close button — the
 * mobile counterpart of Modal and of dropdown menus. Dragging the handle or
 * header down far enough closes it; Escape and a backdrop tap do too. Built on
 * Radix Dialog, so focus is trapped while open.
 * @param open - whether the sheet is shown (default true, for sheets mounted only while open)
 * @param onClose - called on drag-dismiss, Escape, backdrop tap, or the close button
 * @param title - serif heading; also the sheet's accessible name
 * @param children - the sheet body, scrollable when taller than the screen
 * @param className - extra panel classes, e.g. a fixed height
 */
const BottomSheet = ({
    open = true,
    onClose,
    title,
    children,
    className,
}: {
    open?: boolean;
    onClose: () => void;
    title: ReactNode;
    children?: ReactNode;
    className?: string;
}) => {
    const [dragOffset, setDragOffset] = useState(0); // current downward drag distance in px; 0 when not dragging
    const dragStartY = useRef<number | null>(null); // pointer Y where the drag began, or null when not dragging

    /** Starts a drag from the handle/header and captures the pointer so moves outside it still count. */
    const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
        // Let the close button handle its own taps.
        if ((e.target as HTMLElement).closest("button")) return;
        dragStartY.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    /** Follows the pointer downward; dragging up past the start is ignored. */
    const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
        if (dragStartY.current === null) return;
        setDragOffset(Math.max(0, e.clientY - dragStartY.current));
    };

    /** Ends a drag: closes if dragged far enough, otherwise snaps back. */
    const handlePointerUp = () => {
        if (dragStartY.current === null) return;
        dragStartY.current = null;
        if (dragOffset > DISMISS_DISTANCE_PX) onClose();
        setDragOffset(0);
    };

    return (
        <DialogPrimitive.Root
            open={open}
            onOpenChange={(o) => !o && onClose()}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[60] animate-fade-in bg-overlay" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className={cn(
                        "fixed inset-x-0 bottom-0 z-[60] flex max-h-[92dvh] animate-sheet-in flex-col rounded-t-2xl border-t border-line bg-surface-elevated pb-[env(safe-area-inset-bottom)] text-fg shadow-2xl shadow-shadow outline-none",
                        dragOffset === 0 && "transition-transform duration-200",
                        className,
                    )}
                    style={{ transform: `translateY(${dragOffset}px)` }}
                >
                    <div
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        className="shrink-0 touch-none select-none px-4 pb-2"
                    >
                        <div className="mx-auto mb-3 mt-2 h-1 w-9 rounded-full bg-line-strong" />
                        <div className="flex items-center gap-3">
                            <DialogPrimitive.Title className="min-w-0 flex-1 truncate font-serif text-xl font-medium text-fg">
                                {title}
                            </DialogPrimitive.Title>
                            <DialogPrimitive.Close
                                aria-label="Close"
                                className="-mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted outline-none hover:bg-surface-hover hover:text-fg focus-visible:ring-2 focus-visible:ring-gold/60"
                            >
                                <LuX className="h-5 w-5" />
                            </DialogPrimitive.Close>
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                        {children}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

/**
 * Menu entries laid out as large touch rows inside a BottomSheet — the phone
 * version of a DropdownMenu, taking the same MenuEntry list so both can share
 * one definition. Choosing an item calls its onSelect and then onClose.
 * @param items - the rows, as for DropdownMenu
 * @param onClose - closes the enclosing sheet after an item is chosen
 */
export const SheetMenu = ({
    items,
    onClose,
}: {
    items: MenuEntry[];
    onClose: () => void;
}) => (
    <div role="menu" className="-mx-2 flex flex-col">
        {items.map((entry, i) => {
            if (entry.type === "separator")
                return <div key={i} className="mx-2 my-1.5 h-px bg-line" />;
            if (entry.type === "label")
                return (
                    <div key={i} className="px-3 pb-1 pt-2 text-xs text-fg-muted">
                        {entry.label}
                    </div>
                );
            return (
                <button
                    key={i}
                    type="button"
                    role="menuitem"
                    disabled={entry.disabled}
                    onClick={() => {
                        onClose();
                        entry.onSelect();
                    }}
                    className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3.5 rounded-lg px-3 py-2 text-left text-[15px] outline-none active:bg-surface-hover disabled:opacity-50 [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0",
                        entry.destructive ? "text-danger" : "text-fg",
                    )}
                >
                    {entry.icon && (
                        <span
                            className={
                                entry.destructive
                                    ? "text-danger"
                                    : "text-fg-muted"
                            }
                        >
                            {entry.icon}
                        </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{entry.label}</span>
                        {entry.description && (
                            <span className="text-xs text-fg-muted">
                                {entry.description}
                            </span>
                        )}
                    </span>
                </button>
            );
        })}
    </div>
);

export default BottomSheet;
