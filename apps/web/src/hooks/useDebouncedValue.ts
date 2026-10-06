import { useEffect, useState } from "react";

/**
 * Returns `value` once it has stopped changing for `delay` ms, e.g. so a
 * search box queries the server after the user stops typing, not per key.
 * @param value - the fast-changing value
 * @param delay - how long it must stay unchanged, in ms
 */
const useDebouncedValue = <T>(value: T, delay: number) => {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timeout = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timeout);
    }, [value, delay]);

    return debounced;
};

export default useDebouncedValue;
