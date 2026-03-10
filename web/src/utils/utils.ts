// Returns a human-readable relative time string (e.g. "2h ago", "3d ago", "just now").
// Used in the document library table and Ctrl+P overlay.
export const formatRelativeTime = (isoString: string): string => {
    const MINUTE_MS = 60_000;
    const HOUR_MS = 60 * MINUTE_MS;
    const DAY_MS = 24 * HOUR_MS;

    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < MINUTE_MS) return "just now";
    if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
    if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`;
    return `${Math.floor(diff / DAY_MS)}d ago`;
};

// Compares two Yjs state vector Maps for equality.
// Used to detect whether applying an update actually advanced the local state —
// if the SV is unchanged after apply, Yjs buffered the op (missing predecessor).
export const mapsEqual = (
    a: Map<number, number>,
    b: Map<number, number>,
): boolean => {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
        if (b.get(key) !== value) return false;
    }
    return true;
};
