import type {
    ResolvedDocumentAccessLevel,
    WorkspaceDto,
} from "@converge/shared";

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
 * Splits text into consecutive segments, flagging every case-insensitive
 * occurrence of query, e.g. ("RAG Discussion", "rag") →
 * [{ text: "RAG", isMatch: true }, { text: " Discussion", isMatch: false }].
 * An empty query returns the whole text as one unmatched segment.
 * @param text - the text to split, e.g. a document title
 * @param query - the search query to highlight
 */
export const splitByMatch = (
    text: string,
    query: string,
): { text: string; isMatch: boolean }[] => {
    if (!query) return [{ text, isMatch: false }];
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // query as a literal regex pattern
    return text
        .split(new RegExp(`(${escaped})`, "i"))
        .filter((part) => part !== "")
        .map((part) => ({
            text: part,
            isMatch: part.toLowerCase() === query.toLowerCase(),
        }));
};

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
