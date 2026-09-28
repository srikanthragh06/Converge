import type { ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { LuCheck, LuChevronDown } from "react-icons/lu";
import { cn } from "../../lib/utils";

/** One choice in a Select. */
export type SelectOption<T extends string> = { label: string; value: T };

/**
 * Compact dropdown select: a borderless trigger showing the current option,
 * and a popover list with a gold check on the selected option. Keyboard
 * navigation, focus handling, and positioning come from Radix Select.
 * @param value - the selected option's value, or null to show the placeholder
 * @param options - the choices, in display order
 * @param onChange - called with the newly selected value
 * @param placeholder - shown in the trigger while value is null
 * @param disabled - blocks opening the list
 * @param hideChevron - hides the trigger's chevron, e.g. for a read-only value
 * @param onOpen - called each time the list opens, e.g. to refresh the options
 * @param renderOption - custom content for an option, used both in the list and in the trigger
 * @param className - extra trigger classes, e.g. a border
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
    className?: string;
}) => (
    <SelectPrimitive.Root
        // Radix shows the placeholder for "" (option values can never be empty).
        value={value ?? ""}
        onValueChange={(v) => onChange(v as T)}
        onOpenChange={(open) => open && onOpen?.()}
        disabled={disabled}
    >
        <SelectPrimitive.Trigger
            className={cn(
                "inline-flex min-w-0 shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-fg outline-none transition hover:bg-surface-hover focus-visible:ring-1 focus-visible:ring-gold disabled:cursor-default disabled:hover:bg-transparent data-[placeholder]:text-fg-muted sm:px-2 sm:py-1 sm:text-sm",
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
                className="z-[70] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line-strong bg-surface-elevated shadow-lg"
            >
                <SelectPrimitive.Viewport className="p-1">
                    {options.map((option) => (
                        <SelectPrimitive.Item
                            key={option.value}
                            value={option.value}
                            className="relative flex cursor-pointer select-none items-center rounded py-1.5 pl-2 pr-8 text-xs text-fg outline-none data-[highlighted]:bg-surface-hover sm:text-sm"
                        >
                            <SelectPrimitive.ItemText>
                                {renderOption
                                    ? renderOption(option)
                                    : option.label}
                            </SelectPrimitive.ItemText>
                            <SelectPrimitive.ItemIndicator className="absolute right-2 text-gold">
                                <LuCheck className="h-3.5 w-3.5" />
                            </SelectPrimitive.ItemIndicator>
                        </SelectPrimitive.Item>
                    ))}
                </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
);

export default Select;
