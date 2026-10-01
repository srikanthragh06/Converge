import { atomWithStorage } from "jotai/utils";
import type { ThemeMode } from "@/theme/colors";

/** localStorage key for the theme choice. Also read by the inline script in index.html — keep the two in sync. */
const THEME_STORAGE_KEY = "converge-theme";

/** The active color theme, persisted to localStorage. Read on init so the first render already uses the stored choice. */
export const themeAtom = atomWithStorage<ThemeMode>(
    THEME_STORAGE_KEY,
    "dark",
    undefined,
    { getOnInit: true },
);
