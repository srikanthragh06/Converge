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

/** Initials-avatar fill classes, one per avatar color token. */
const AVATAR_COLORS = [
    "bg-avatar-1",
    "bg-avatar-2",
    "bg-avatar-3",
    "bg-avatar-4",
    "bg-avatar-5",
];

/**
 * Workspace tile fills: the avatar colors minus the rust avatar-2, which
 * reads too close to the gold personal-workspace tile.
 */
export const WORKSPACE_TILE_COLORS = AVATAR_COLORS.filter(
    (c) => c !== "bg-avatar-2",
);

/**
 * Picks a stable avatar fill class for a key, so the same person (or
 * workspace) always gets the same color.
 * @param key - any stable identifier, e.g. a user id or name
 * @param colors - the fill classes to pick from (default: every avatar color)
 */
export const getAvatarColor = (key: string, colors = AVATAR_COLORS) => {
    let hash = 0;
    for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return colors[Math.abs(hash) % colors.length];
};
