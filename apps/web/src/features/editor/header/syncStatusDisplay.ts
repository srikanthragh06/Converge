import type { StatusTone } from "@/components/ui/Badge";

/** The editor's sync state, as held in syncStatusAtom (null = everything saved). */
type SyncStatus = "offline" | "restoring" | "typing" | "syncing" | null;

/**
 * The status dot shown beside the document name: its tone and label. Unsent
 * local edits ("typing") and in-flight ones ("syncing") both read as
 * Syncing…, as in the design, which only distinguishes Saved / Syncing /
 * Offline.
 * @param status - the current sync state
 */
export const getSyncStatusDisplay = (
    status: SyncStatus,
): { tone: StatusTone; label: string } => {
    switch (status) {
        case "offline":
            return { tone: "danger", label: "Offline" };
        case "restoring":
            return { tone: "pending", label: "Loading…" };
        case "typing":
        case "syncing":
            return { tone: "pending", label: "Syncing…" };
        default:
            return { tone: "success", label: "Saved" };
    }
};
