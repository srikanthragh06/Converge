import { useEffect, useState } from "react";

/**
 * Registers a global Ctrl+P keyboard shortcut that opens the document switcher
 * and suppresses the browser's print dialog. Owns the switcher visibility state
 * so callers do not need to declare it separately.
 *
 * @returns isSwitcherOpen — whether the overlay is visible; setIsSwitcherOpen — setter to close it
 */
const useDocumentSwitcherShortcut = () => {
    const [isSwitcherOpen, setIsSwitcherOpen] = useState(false); // controls document switcher overlay visibility

    // Attaches the global keydown listener on mount and removes it on cleanup.
    // setIsSwitcherOpen is a useState setter — React guarantees it is stable — so this
    // effect runs only once.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "p") {
                e.preventDefault();
                setIsSwitcherOpen(true);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [setIsSwitcherOpen]);

    return { isSwitcherOpen, setIsSwitcherOpen };
};

export default useDocumentSwitcherShortcut;
