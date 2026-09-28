import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** True on macOS and iOS, where the primary shortcut modifier is ⌘ rather than Ctrl. */
export const IS_APPLE = /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * Formats a shortcut for display with the platform's primary modifier:
 * "⌘K" on Apple devices, "Ctrl K" elsewhere.
 * @param key - the key pressed together with the modifier, e.g. "K"
 */
export const formatShortcut = (key: string) =>
    IS_APPLE ? `⌘${key}` : `Ctrl ${key}`;
