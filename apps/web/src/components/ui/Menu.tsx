import type { ReactElement, ReactNode } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { LuCheck } from "react-icons/lu";
import { cn } from "../../lib/utils";

/** A clickable menu row. */
export type MenuItem = {
    type?: "item";
    /** Row text. */
    label: ReactNode;
    /** Called when the row is chosen by click or keyboard; the menu then closes. */
    onSelect: () => void;
    /** Leading icon, e.g. `<LuLink />`. */
    icon?: ReactNode;
    /** Muted second line under the label. */
    description?: ReactNode;
    /** Keyboard hint shown at the row's right edge, e.g. "⌘K". */
    shortcut?: string;
    /** Shows a gold check at the right edge, e.g. the current workspace. */
    checked?: boolean;
    /** Red text and icon, for an action like "Move to Trash". */
    destructive?: boolean;
    disabled?: boolean;
};

/** One row in a menu: an item, a divider line, or a muted section header. */
export type MenuEntry =
    | MenuItem
    | { type: "separator" }
    | { type: "label"; label: ReactNode };

/** The Radix parts both menu kinds share, so one renderer serves both. */
type MenuParts = Pick<
    typeof DropdownMenuPrimitive,
    "Item" | "Separator" | "Label"
>;

/** Popup panel classes, shared by the dropdown and context menu. */
const CONTENT_CLASSES =
    "z-[70] min-w-[13rem] max-w-[20rem] animate-fade-in overflow-hidden rounded-lg border border-line-strong bg-surface-elevated p-1 text-fg shadow-lg shadow-shadow outline-none";

/**
 * Renders menu entries with the given Radix parts.
 * @param parts - DropdownMenu's or ContextMenu's Item / Separator / Label
 * @param entries - the rows to render, in order
 */
const renderEntries = (parts: MenuParts, entries: MenuEntry[]) =>
    entries.map((entry, i) => {
        if (entry.type === "separator")
            return <parts.Separator key={i} className="-mx-1 my-1 h-px bg-line" />;
        if (entry.type === "label")
            return (
                <parts.Label
                    key={i}
                    className="px-2.5 pb-1 pt-1.5 text-xs text-fg-muted"
                >
                    {entry.label}
                </parts.Label>
            );
        return (
            <parts.Item
                key={i}
                onSelect={entry.onSelect}
                disabled={entry.disabled}
                className={cn(
                    "flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-hover data-[disabled]:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
                    entry.destructive ? "text-danger" : "text-fg",
                )}
            >
                {entry.icon && (
                    <span
                        className={
                            entry.destructive ? "text-danger" : "text-fg-muted"
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
                {entry.shortcut && (
                    <span className="text-xs text-fg-muted">
                        {entry.shortcut}
                    </span>
                )}
                {entry.checked && (
                    <LuCheck className="!h-3.5 !w-3.5 text-gold" />
                )}
            </parts.Item>
        );
    });

/**
 * Menu that opens from a trigger on click (e.g. a ⋯ button or the workspace
 * switcher). Keyboard navigation, focus, and positioning come from Radix.
 * @param trigger - the element that opens the menu; must accept a ref and
 *                  event props (a DOM element or a forwarding component like Button)
 * @param items - the menu rows
 * @param align - edge of the trigger the menu lines up with (default "end")
 * @param side - side of the trigger the menu opens on (default "bottom")
 * @param onOpenChange - called when the menu opens or closes, e.g. to keep a row's hover actions visible
 * @param className - extra panel classes, e.g. a width
 */
export const DropdownMenu = ({
    trigger,
    items,
    align = "end",
    side = "bottom",
    onOpenChange,
    className,
}: {
    trigger: ReactElement;
    items: MenuEntry[];
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    onOpenChange?: (open: boolean) => void;
    className?: string;
}) => (
    <DropdownMenuPrimitive.Root onOpenChange={onOpenChange}>
        <DropdownMenuPrimitive.Trigger asChild>
            {trigger}
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                align={align}
                side={side}
                sideOffset={4}
                collisionPadding={8}
                className={cn(CONTENT_CLASSES, className)}
            >
                {renderEntries(DropdownMenuPrimitive, items)}
            </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
);

/**
 * Menu that opens at the pointer on right-click (or long-press on touch)
 * anywhere inside its children, e.g. a sidebar document row.
 * @param children - the area that responds to right-click; a single element that accepts a ref
 * @param items - the menu rows
 * @param onOpenChange - called when the menu opens or closes
 * @param className - extra panel classes
 */
export const ContextMenu = ({
    children,
    items,
    onOpenChange,
    className,
}: {
    children: ReactElement;
    items: MenuEntry[];
    onOpenChange?: (open: boolean) => void;
    className?: string;
}) => (
    <ContextMenuPrimitive.Root onOpenChange={onOpenChange}>
        <ContextMenuPrimitive.Trigger asChild>
            {children}
        </ContextMenuPrimitive.Trigger>
        <ContextMenuPrimitive.Portal>
            <ContextMenuPrimitive.Content
                collisionPadding={8}
                className={cn(CONTENT_CLASSES, className)}
            >
                {renderEntries(ContextMenuPrimitive, items)}
            </ContextMenuPrimitive.Content>
        </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
);
