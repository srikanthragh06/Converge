import { useEffect, useState } from "react";

/**
 * Tracks whether an element is on screen, e.g. a sentinel at the end of a
 * list that loads the next page when it scrolls into view. Attach `ref` to
 * the element; `inView` is true while it's visible.
 */
const useInView = () => {
    const [element, setElement] = useState<Element | null>(null); // the observed element, as state so the observer re-attaches when it mounts
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (!element) return;
        const observer = new IntersectionObserver(
            ([entry]) => setInView(entry.isIntersecting),
            { threshold: 0.1 },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);

    return { ref: setElement, inView };
};

export default useInView;
