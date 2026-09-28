import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { isSearchOpenAtom } from "../atoms/search";
import { IS_APPLE } from "../lib/utils";

/**
 * Registers the app-wide keyboard shortcuts shown in the sidebar: ⌘K (Ctrl K
 * off Apple devices) opens document search, and ⌘J opens Ask Converge.
 * Ctrl+P also opens search, the switcher's original shortcut.
 * @param enabled - registers the shortcuts only while true, e.g. on pages with the sidebar
 */
const useAppShortcuts = (enabled: boolean) => {
    const setIsSearchOpen = useSetAtom(isSearchOpenAtom); // opens the search palette
    const navigate = useNavigate(); // goes to the agent page for ⌘J

    // Listens for the shortcuts while enabled; preventDefault stops the browser's
    // own binding for the same keys (address-bar search, downloads, print).
    useEffect(() => {
        if (!enabled) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey || e.shiftKey) return;
            const isMod = IS_APPLE ? e.metaKey : e.ctrlKey;
            const key = e.key.toLowerCase();
            if ((isMod && key === "k") || (e.ctrlKey && key === "p")) {
                e.preventDefault();
                setIsSearchOpen(true);
            } else if (isMod && key === "j") {
                e.preventDefault();
                // Ask Converge is a page for now; it becomes an overlay in redesign 8.1.
                navigate("/agent");
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [enabled, navigate, setIsSearchOpen]);
};

export default useAppShortcuts;
