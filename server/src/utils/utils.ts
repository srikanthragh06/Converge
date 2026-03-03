// Shared server-side utilities: state vector comparison, socket error boundary,
// and async sleep. No external dependencies — safe to import from any service.

// Compares two Yjs state vector Maps for equality.
// A state vector maps clientID → lamport clock; equality means both peers have
// seen identical logical time for every client.
// Used after applying an update to detect whether local state actually advanced —
// if the SV is unchanged, Yjs buffered the op due to a missing causal predecessor,
// signalling that a repair round-trip is needed.
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

// Wraps a socket event handler in a try/catch so any uncaught error is logged
// rather than propagating and crashing the process.
// Every socket.on() registration should use this wrapper.
export const safeSocketHandler =
    (fn: (...args: any[]) => void) =>
    async (...args: any[]) => {
        try {
            await fn(...args);
        } catch (err) {
            console.error(`Socket error: ${String(err)}`);
        }
    };

// Resolves after ms milliseconds. Used in retry loops (e.g. waitForDb) to
// pause between connection attempts without blocking the event loop.
export const sleep = (ms: number): Promise<void> => {
    return new Promise((r) => setTimeout(r, ms));
};
