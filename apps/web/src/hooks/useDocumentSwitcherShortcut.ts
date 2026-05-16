import { useEffect } from "react";

/**
 * Registers a global Ctrl+P keyboard shortcut that opens the document switcher
 * and suppresses the browser's print dialog.
 *
 * @param setIsOpen - state setter from the document switcher's visibility state
 */
const useDocumentSwitcherShortcut = (
    setIsOpen: (open: boolean) => void,
) => {
    // Attaches the global keydown listener on mount and removes it on cleanup.
    // setIsOpen is a useState setter — React guarantees it is stable — so this
    // effect runs only once.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "p") {
                e.preventDefault();
                setIsOpen(true);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [setIsOpen]);
};

export default useDocumentSwitcherShortcut;
