// Displays a sync status label with a fade-in / fade-out transition and animated dots.
// Stays mounted briefly after the label clears so the fade-out animation can complete.
import { useEffect, useState } from "react";
import AnimatedDots from "./AnimatedDots";

export default function SyncStatus({ label }: { label: string | null }) {
    // Duration in ms for the opacity transition (must match Tailwind `duration-500`)
    const FADE_MS = 500;

    // Whether the element is rendered in the DOM at all
    const [mounted, setMounted] = useState(false);
    // Whether the element is fully opaque (drives CSS opacity transition)
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (label) {
            // Mount first, then make visible on the next animation frame so the
            // transition fires correctly (opacity 0 → 1 rather than snapping)
            setMounted(true);
            requestAnimationFrame(() => setVisible(true));
        } else {
            // Fade out, then unmount after the transition completes
            setVisible(false);
            const id = setTimeout(() => setMounted(false), FADE_MS);
            return () => clearTimeout(id);
        }
    }, [label]);

    if (!mounted) return null;

    return (
        <span
            className="text-xs text-white/50 flex items-center gap-0.5 transition-opacity duration-500"
            style={{ opacity: visible ? 1 : 0 }}
        >
            {label}
            <AnimatedDots />
        </span>
    );
}
