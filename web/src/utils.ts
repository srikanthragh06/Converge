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
