import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Height of an Input: "md" for forms and dialogs, "lg" for a page's filter bar. */
export type InputSize = "md" | "lg";

/** Wrapper height and horizontal padding per size. */
const SIZE_CLASSES: Record<InputSize, string> = {
    md: "h-9 px-3 sm:h-10",
    lg: "h-10 px-3.5 sm:h-11",
};

/**
 * Single-line text field on an inset surface with a gold focus ring. The
 * wrapper carries the border, so a leading icon and trailing content sit
 * inside it. Extra input props (including ref) go to the <input> itself.
 * @param icon - leading icon, e.g. `<LuSearch />` for a filter field
 * @param trailing - content at the right edge, e.g. a key hint or a clear button
 * @param inputSize - "md" (default) or "lg"
 * @param invalid - red border and aria-invalid, for a field with an error below it
 * @param className - extra wrapper classes, e.g. a width or margin
 */
const Input = ({
    icon,
    trailing,
    inputSize = "md",
    invalid,
    className,
    ...rest
}: {
    icon?: ReactNode;
    trailing?: ReactNode;
    inputSize?: InputSize;
    invalid?: boolean;
} & ComponentProps<"input">) => (
    <div
        className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border bg-surface-inset text-sm transition-colors focus-within:ring-2 has-[:disabled]:opacity-60",
            invalid
                ? "border-danger focus-within:ring-danger/20"
                : "border-line-strong focus-within:border-gold focus-within:ring-gold/20",
            SIZE_CLASSES[inputSize],
            className,
        )}
    >
        {icon && (
            <span className="flex shrink-0 text-fg-muted [&_svg]:h-4 [&_svg]:w-4">
                {icon}
            </span>
        )}
        <input
            aria-invalid={invalid || undefined}
            className="h-full min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-muted disabled:cursor-not-allowed"
            {...rest}
        />
        {trailing && (
            <span className="flex shrink-0 items-center text-xs text-fg-muted">
                {trailing}
            </span>
        )}
    </div>
);

export default Input;
