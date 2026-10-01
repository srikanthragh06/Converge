import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copies text to the clipboard and reports it for two seconds, e.g. to swap
 * a Copy button to "Copied". A denied clipboard is logged, not thrown.
 * @returns copied (true for two seconds after a successful copy) and copy(text)
 */
const useCopyToClipboard = () => {
    const [copied, setCopied] = useState(false); // true briefly after a successful copy
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // resets copied; cleared on unmount

    /**
     * Copies the given text.
     * @param text - what to put on the clipboard
     */
    const copy = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("useCopyToClipboard: copy failed:", err);
        }
    }, []);

    // Clears a pending reset on unmount.
    useEffect(
        () => () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        },
        [],
    );

    return { copied, copy };
};

export default useCopyToClipboard;
