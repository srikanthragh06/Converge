import type { ResolvedDocumentAccessLevel } from "@converge/shared";

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

/** Returns true if the string is a valid email address. */
export const isValidEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Formats a Date as "Sep 5, 1999, 1:25:59 a.m.".
 */
export const formatDate = (date: Date | string): string =>
    new Date(date)
        .toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
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
