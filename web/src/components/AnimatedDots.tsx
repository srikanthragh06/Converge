// Cycles through dot counts (0 → 1 → 2 → 3 → 0…) at 400ms intervals.
// Used as a trailing animation on status messages like "Restoring sync...".
// Fixed-width span prevents surrounding text from shifting as dots change.
import { useEffect, useState } from "react";

export default function AnimatedDots() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const id = setInterval(() => {
            setCount((c) => (c + 1) % 4);
        }, 400);
        return () => clearInterval(id);
    }, []);

    return (
        <span className="inline-block w-[18px] text-left">
            {".".repeat(count)}
        </span>
    );
}
