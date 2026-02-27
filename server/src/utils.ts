// Wraps a socket event handler so any uncaught error is logged rather than crashing the process
export const safeSocketHandler =
    (fn: (...args: any[]) => void) =>
    async (...args: any[]) => {
        try {
            await fn(...args);
        } catch (err) {
            console.error(`Socket error: ${String(err)}`);
        }
    };
