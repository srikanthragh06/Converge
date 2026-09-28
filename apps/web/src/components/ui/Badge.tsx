import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/utils";

/** Color of a Badge. */
export type BadgeVariant = "neutral" | "gold" | "outline" | "danger";

/** Classes per badge variant. */
const BADGE_CLASSES: Record<BadgeVariant, string> = {
    neutral: "bg-surface-selected text-fg-secondary",
    gold: "bg-gold text-gold-fg",
    outline: "border border-line-strong text-fg-muted",
    danger: "border border-danger/70 text-danger",
};

/**
 * Small rounded label next to a name or in a row, e.g. "Personal",
 * "Current", "Auto", or "Revoked".
 * @param variant - "neutral" (default, quiet tag), "gold" (the active or
 *                  current item), "outline" (secondary metadata), or
 *                  "danger" (a dead or revoked state)
 */
export const Badge = ({
    variant = "neutral",
    className,
    ...rest
}: { variant?: BadgeVariant } & ComponentProps<"span">) => (
    <span
        className={cn(
            "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-md px-1.5 text-[11px] font-medium leading-none",
            BADGE_CLASSES[variant],
            className,
        )}
        {...rest}
    />
);

/** Meaning of a StatusDot, which sets its color. */
export type StatusTone = "success" | "pending" | "muted" | "danger";

/** Dot color per tone. */
const DOT_CLASSES: Record<StatusTone, string> = {
    success: "bg-success",
    pending: "bg-gold animate-pulse",
    muted: "bg-fg-muted",
    danger: "bg-danger",
};

/**
 * Small colored dot with an optional muted label, e.g. "● Saved" in the
 * editor header or "● Up to date" for search indexing.
 * @param tone - "success" (green), "pending" (pulsing gold, e.g. Syncing),
 *               "muted" (grey, e.g. Offline), or "danger" (red, e.g. a failure)
 * @param label - text after the dot; without it, pass an aria-label so the status is announced
 */
export const StatusDot = ({
    tone,
    label,
    className,
    ...rest
}: {
    tone: StatusTone;
    label?: ReactNode;
} & ComponentProps<"span">) => (
    <span
        role="status"
        className={cn(
            "inline-flex items-center gap-1.5 text-xs text-fg-muted",
            className,
        )}
        {...rest}
    >
        <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])}
        />
        {label}
    </span>
);
