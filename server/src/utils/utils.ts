/**
 * Returns true if two Maps contain identical key-value pairs.
 * Used to compare Yjs state vectors (Map<number, number>) after sync operations.
 * @param a - the first map to compare
 * @param b - the second map to compare
 * @returns true if both maps have the same size and every entry in `a` matches `b`
 */
export const mapsAreEqual = <K, V>(a: Map<K, V>, b: Map<K, V>): boolean => {
    // short-circuit if sizes differ — can't be equal
    if (a.size !== b.size) return false;
    // check every entry in `a` exists in `b` with the same value
    for (const [key, value] of a) {
        if (!b.has(key) || b.get(key) !== value) return false;
    }
    return true;
};
