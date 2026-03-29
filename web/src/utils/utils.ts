export const mapsAreEqual = <K, V>(a: Map<K, V>, b: Map<K, V>): boolean => {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
        if (!b.has(key) || b.get(key) !== value) return false;
    }
    return true;
};
