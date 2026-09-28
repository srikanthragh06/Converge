import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/** Visual style of a Button. */
export type ButtonVariant =
    | "primary"
    | "secondary"
    | "ghost"
    | "destructive"
    | "destructive-outline";

/** Height and padding of a Button; "icon" is a square icon-only button. */
export type ButtonSize = "sm" | "md" | "icon" | "icon-sm";

/** Classes for each variant: fill, text, border, and hover/active states. */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary: "bg-gold text-gold-fg hover:bg-gold/90 active:bg-gold/80",
    secondary:
        "border border-line-strong bg-surface-elevated text-fg hover:bg-surface-hover active:bg-surface-selected",
    ghost: "text-fg-secondary hover:bg-surface-hover hover:text-fg active:bg-surface-selected",
    destructive:
        "bg-danger-solid text-danger-solid-fg hover:bg-danger-solid/90 active:bg-danger-solid/80",
    "destructive-outline":
        "border border-danger/70 text-danger hover:bg-danger/10 active:bg-danger/15",
};

/** Classes for each size. Text sizes step down one notch on phones. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: "h-7 gap-1.5 px-2.5 text-xs",
    md: "h-8 gap-2 px-3 text-xs sm:h-9 sm:px-3.5 sm:text-sm",
    icon: "h-8 w-8 sm:h-9 sm:w-9",
    "icon-sm": "h-7 w-7",
};

/**
 * The app's one button style. Children are laid out in a row with a gap, so
 * an icon can sit before or after the label. Extra button props (including
 * ref) are forwarded, so it can be a Tooltip or menu trigger.
 * @param variant - "primary" (gold, the page's main action), "secondary"
 *                  (outlined), "ghost" (no chrome until hover),
 *                  "destructive" (filled red), or "destructive-outline"
 *                  (red outline, for a destructive action in a list row)
 * @param size - "sm", "md" (default), or square "icon" / "icon-sm"
 * @param pressed - shows the selected fill, for a toggled icon button such as an open panel
 */
const Button = ({
    variant = "secondary",
    size = "md",
    pressed,
    type = "button",
    className,
    ...rest
}: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    pressed?: boolean;
} & ComponentProps<"button">) => (
    <button
        type={type}
        aria-pressed={pressed}
        className={cn(
            "inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-md font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gold/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
            VARIANT_CLASSES[variant],
            SIZE_CLASSES[size],
            pressed && "bg-surface-selected text-fg",
            className,
        )}
        {...rest}
    />
);

export default Button;
