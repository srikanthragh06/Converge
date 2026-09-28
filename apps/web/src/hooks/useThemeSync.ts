import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { themeAtom } from "../atoms/theme";

/**
 * Mirrors themeAtom onto `<html>`: `data-theme` selects the active set of
 * theme CSS variables, and `color-scheme` makes native controls and
 * scrollbars match. Same two writes as the inline script in index.html,
 * which covers the first paint. Call once, at the app root.
 */
const useThemeSync = () => {
    const theme = useAtomValue(themeAtom); // active color theme

    // Re-point the CSS variables and native color scheme whenever the theme changes.
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
    }, [theme]);
};

export default useThemeSync;
