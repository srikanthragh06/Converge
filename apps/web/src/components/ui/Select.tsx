import type { ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { LuCheck, LuChevronDown } from "react-icons/lu";
import { cn } from "@/lib/utils";

/** One choice in a Select. */
export type SelectOption<T extends string> = { label: string; value: T };

/** An extra command at the bottom of a Select's list, e.g. "Reset to workspace default". */
export type SelectAction = { label: string; onSelect: () => void };

/** Trigger style: "ghost" is borderless until hover; "outline" is a bordered box. */
export type SelectVariant = "ghost" | "outline";

/**
 * Option value used internally for the footer action row. Never a real
 * option value, so selecting it can be told apart from a choice.
 */
const ACTION_VALUE = "__select_action__";

/** Trigger classes per variant. */
const TRIGGER_CLASSES: Record<SelectVariant, string> = {
    ghost: "gap-1 rounded-md px-1.5 py-0.5 hover:bg-surface-hover focus-visible:ring-1 focus-visible:ring-gold disabled:hover:bg-transparent sm:px-2 sm:py-1",
    outline:
        "h-8 min-w-[6.5rem] justify-between gap-2 rounded-md border border-line-strong bg-surface-inset px-2.5 hover:border-fg-muted/60 focus-visible:border-gold data-[state=open]:border-gold disabled:opacity-60 disabled:hover:border-line-strong sm:h-9 sm:px-3",
};

/** Classes shared by every row in the list (options and the footer action). */
const ITEM_CLASSES =
    "relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-2.5 pr-8 text-xs text-fg outline-none data-[highlighted]:bg-surface-hover sm:py-2 sm:text-sm";

/**
 * Dropdown select: a trigger showing the current option, and a popover list
 * with a gold check on the selected option. Keyboard navigation, focus
 * handling, and positioning come from Radix Select.
 * @param value - the selected option's value, or null to show the placeholder
 * @param options - the choices, in display order
 * @param onChange - called with the newly selected value
 * @param placeholder - shown in the trigger while value is null
 * @param disabled - blocks opening the list
 * @param hideChevron - hides the trigger's chevron, e.g. for a read-only value
 * @param onOpen - called each time the list opens, e.g. to refresh the options
 * @param renderOption - custom content for an option, used both in the list and in the trigger
 * @param variant - trigger style (default "ghost")
 * @param label - muted header above the options, e.g. "Workspace default: Viewer"
 * @param action - command shown below the options after a separator; selecting
 *                 it calls its onSelect and leaves the value unchanged
 * @param className - extra trigger classes, e.g. a width
 */
const Select = <T extends string>({
    value,
    options,
    onChange,
    placeholder,
    disabled,
    hideChevron,
    onOpen,
    renderOption,
    variant = "ghost",
    label,
    action,
    className,
}: {
    value: T | null;
    options: SelectOption<T>[];
    onChange: (value: T) => void;
    placeholder?: string;
    disabled?: boolean;
    hideChevron?: boolean;
    onOpen?: () => void;
    renderOption?: (option: SelectOption<T>) => ReactNode;
    variant?: SelectVariant;
    label?: ReactNode;
    action?: SelectAction;
    className?: string;
}) => (
    <SelectPrimitive.Root
        // Radix shows the placeholder for "" (option values can never be empty).
        value={value ?? ""}
        onValueChange={(v) =>
            v === ACTION_VALUE ? action?.onSelect() : onChange(v as T)
        }
        onOpenChange={(open) => open && onOpen?.()}
        disabled={disabled}
    >
        <SelectPrimitive.Trigger
            className={cn(
                "inline-flex min-w-0 shrink-0 items-center text-xs text-fg outline-none transition disabled:cursor-default data-[placeholder]:text-fg-muted sm:text-sm",
                TRIGGER_CLASSES[variant],
                className,
            )}
        >
            <span className="min-w-0 truncate">
                <SelectPrimitive.Value placeholder={placeholder} />
            </span>
            {!hideChevron && (
                <SelectPrimitive.Icon className="shrink-0 text-fg-muted">
                    <LuChevronDown className="h-3.5 w-3.5" />
                </SelectPrimitive.Icon>
            )}
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                position="popper"
                sideOffset={4}
                collisionPadding={8}
                className="z-[70] max-h-[var(--radix-select-content-available-height)] min-w-[max(var(--radix-select-trigger-width),10rem)] animate-fade-in overflow-hidden rounded-lg border border-line-strong bg-surface-elevated shadow-lg shadow-shadow"
            >
                <SelectPrimitive.Viewport className="p-1">
                    {label && (
                        <div className="px-2.5 pb-1 pt-1.5 text-xs text-fg-muted">
                            {label}
                        </div>
                    )}
                    {options.map((option) => (
                        <SelectPrimitive.Item
                            key={option.value}
                            value={option.value}
                            className={ITEM_CLASSES}
                        >
                            <SelectPrimitive.ItemText>
                                {renderOption
                                    ? renderOption(option)
                                    : option.label}
                            </SelectPrimitive.ItemText>
                            <SelectPrimitive.ItemIndicator className="absolute right-2.5 text-gold">
                                <LuCheck className="h-3.5 w-3.5" />
                            </SelectPrimitive.ItemIndicator>
                        </SelectPrimitive.Item>
                    ))}
                    {action && (
                        <>
                            <SelectPrimitive.Separator className="-mx-1 my-1 h-px bg-line" />
                            <SelectPrimitive.Item
                                value={ACTION_VALUE}
                                className={ITEM_CLASSES}
                            >
                                {/* Not ItemText, so the trigger never displays the action's label. */}
                                {action.label}
                            </SelectPrimitive.Item>
                        </>
                    )}
                </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
);

export default Select;
