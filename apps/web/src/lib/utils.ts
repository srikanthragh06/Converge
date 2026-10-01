import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type {
    ResolvedDocumentAccessLevel,
    WorkspaceDto,
} from "@converge/shared";

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

export { hasAccess } from "@converge/shared";

/** Maps a resolved access level to a human-readable display label. */
export const formatAccessLevel = (
    access: ResolvedDocumentAccessLevel,
): string => {
    const labels: Record<ResolvedDocumentAccessLevel, string> = {
        owner: "Owner",
        admin: "Admin",
        editor: "Editor",
        viewer: "Viewer",
        noAccess: "No access",
    };
    return labels[access];
};

/**
 * One-line description of the user's place in a workspace, shown under its
 * name in the sidebar: "Personal · Owner" for their personal workspace,
 * otherwise their role ("Admin", "Member", "Owner").
 * @param workspace - the workspace's type and the user's role in it
 */
export const describeWorkspace = (
    workspace: Pick<WorkspaceDto, "type" | "role">,
): string => {
    const role =
        workspace.role.charAt(0).toUpperCase() + workspace.role.slice(1);
    return workspace.type === "personal" ? `Personal · ${role}` : role;
};

/** Returns true if the string is a valid email address. */
export const isValidEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Formats a Date as "Sep 5, 1999, 1:25:59 a.m.".
 * @param date - the date to format
 * @param options.seconds - include seconds (default true); false gives "Sep 5, 1999, 1:25 a.m."
 */
export const formatDate = (
    date: Date | string,
    { seconds = true }: { seconds?: boolean } = {},
): string =>
    new Date(date)
        .toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: seconds ? "2-digit" : undefined,
            hour12: true,
        })
        .replace(/\bAM\b/, "a.m.")
        .replace(/\bPM\b/, "p.m.");

/**
 * Returns a compact relative time string (e.g. "3d ago", "just now") for a given date.
 * Granularity steps: seconds → minutes → hours → days → months → years.
 */
export const timeAgo = (date: Date | string): string => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
};
