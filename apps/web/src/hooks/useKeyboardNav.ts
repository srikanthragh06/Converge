import { useEffect, useRef, useState } from "react";

/**
 * Manages keyboard navigation over a flat list.
 * ArrowDown/ArrowUp move the focus, Enter selects the focused item.
 * Auto-focuses the first item when the list loads or changes, and clears focus when it empties.
 * Attach the returned listRef to the scrollable container so the focused
 * item is automatically scrolled into view.
 */
const useKeyboardNav = (count: number, onSelect: (index: number) => void) => {
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null); // index of the keyboard-focused item, or null if none
    const listRef = useRef<HTMLDivElement>(null); // ref attached to the scrollable list container for scroll-into-view

    // Auto-focus the first item when the list loads or changes; clear focus when the list empties.
    useEffect(() => {
        setFocusedIndex(count > 0 ? 0 : null);
    }, [count]);

    // Scroll the focused item into view whenever the index changes.
    useEffect(() => {
        if (focusedIndex === null || !listRef.current) return;
        const item = listRef.current.children[focusedIndex] as
            | HTMLElement
            | undefined;
        item?.scrollIntoView({ block: "nearest" });
    }, [focusedIndex]);

    // Attach a window keydown listener for ArrowUp, ArrowDown, and Enter navigation.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (count === 0) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedIndex((prev) =>
                    prev === null ? 0 : Math.min(prev + 1, count - 1),
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedIndex((prev) =>
                    prev === null ? count - 1 : Math.max(prev - 1, 0),
                );
            } else if (e.key === "Enter" && focusedIndex !== null) {
                e.preventDefault();
                onSelect(focusedIndex);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [count, focusedIndex, onSelect]);

    return { focusedIndex, listRef };
};

export default useKeyboardNav;
