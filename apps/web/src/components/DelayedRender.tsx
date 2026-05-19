import { type ReactNode, useEffect, useState } from "react";

/**
 * Renders children only after the given delay (default 200ms). If the parent
 * unmounts before the delay elapses — because the data loaded fast enough —
 * nothing is ever rendered. Prevents skeleton flicker on fast connections.
 */
const DelayedRender = ({
    children,
    delay = 200,
}: {
    children: ReactNode;
    delay?: number; // milliseconds to wait before rendering children
}) => {
    const [show, setShow] = useState(false); // becomes true once the delay elapses

    // Sets show to true after the delay; cleans up the timer if the component unmounts first.
    useEffect(() => {
        const timer = setTimeout(() => setShow(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    if (!show) return null;
    return <>{children}</>;
};

export default DelayedRender;
