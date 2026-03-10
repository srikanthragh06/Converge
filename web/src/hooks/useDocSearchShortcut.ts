// Registers a global Ctrl+P (or Cmd+P on Mac) listener that toggles the
// document search overlay. Prevents the browser's native print dialog from opening.
// Call once at the app level (App.tsx).

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { isDocSearchOpenAtom } from "../atoms/uiAtoms";

const useDocSearchShortcut = () => {
    const setIsDocSearchOpen = useSetAtom(isDocSearchOpenAtom);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "p") {
                e.preventDefault();
                setIsDocSearchOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);
};

export default useDocSearchShortcut;
