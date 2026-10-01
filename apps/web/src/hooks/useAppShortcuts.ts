import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { isSearchOpenAtom } from "../atoms/search";
import { isAgentPanelOpenAtom } from "../atoms/agent";
import { IS_APPLE } from "../lib/utils";

/**
 * Registers the app-wide keyboard shortcuts shown in the sidebar: ⌘K (Ctrl K
 * off Apple devices) opens document search, and ⌘J opens or closes the Ask
 * Converge panel.
 * Ctrl+P also opens search, the switcher's original shortcut.
 */
const useAppShortcuts = () => {
    const setIsSearchOpen = useSetAtom(isSearchOpenAtom); // opens the search palette
    const setIsAgentPanelOpen = useSetAtom(isAgentPanelOpenAtom); // toggles the Ask Converge panel

    // Listens for the shortcuts; preventDefault stops the browser's
    // own binding for the same keys (address-bar search, downloads, print).
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey || e.shiftKey) return;
            const isMod = IS_APPLE ? e.metaKey : e.ctrlKey;
            const key = e.key.toLowerCase();
            if ((isMod && key === "k") || (e.ctrlKey && key === "p")) {
                e.preventDefault();
                setIsAgentPanelOpen(false); // one overlay at a time
                setIsSearchOpen(true);
            } else if (isMod && key === "j") {
                e.preventDefault();
                setIsAgentPanelOpen((open) => !open);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [setIsAgentPanelOpen, setIsSearchOpen]);
};

export default useAppShortcuts;
