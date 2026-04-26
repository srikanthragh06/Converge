import { useEffect, useState } from "react";

/**
 * Cycles through 0–3 trailing dots at 200ms intervals.
 * Fixed-width span prevents surrounding text from shifting as the dot count changes.
 */
export default function AnimatedDots() {
    const [count, setCount] = useState(0); // number of dots currently shown (0–3)

    // Advance the dot count on a fixed interval; clear on unmount.
    useEffect(() => {
        const id = setInterval(() => {
            setCount((c) => (c + 1) % 4);
        }, 200);
        return () => clearInterval(id);
    }, []);

    return (
        <span className="inline-block w-[18px] text-left">
            {".".repeat(count)}
        </span>
    );
}
