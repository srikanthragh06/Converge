import { type ColorScheme } from "@blocknote/mantine";
import { HIGHLIGHT_NAMES, type HighlightName } from "./colors";

/**
 * Reads a theme token's CSS variable as a color (see themeVariables.ts).
 * @param name - token or highlight variable name, without the leading "--"
 * @returns a CSS color expression that follows the active theme
 */
const tokenColor = (name: string) => `rgb(var(--${name}))`;

/** BlockNote highlight palette, each color read from its theme variable. */
const highlights = Object.fromEntries(
    HIGHLIGHT_NAMES.map((name) => [
        name,
        {
            text: tokenColor(`highlight-${name}`),
            background: tokenColor(`highlight-${name}-bg`),
        },
    ]),
) as Record<HighlightName, { text: string; background: string }>;

/**
 * BlockNote theme for every editor in the app. Colors are CSS variable
 * references rather than fixed values, so one theme object follows the
 * active light/dark theme with no re-render when it changes.
 */
export const convergeTheme: Partial<{
    colors: ColorScheme;
    borderRadius: number;
    fontFamily: string;
}> = {
    colors: {
        editor: { text: tokenColor("fg"), background: tokenColor("surface") },
        menu: {
            text: tokenColor("fg"),
            background: tokenColor("surface-elevated"),
        },
        tooltip: {
            text: tokenColor("tooltip-fg"),
            background: tokenColor("tooltip"),
        },
        hovered: {
            text: tokenColor("fg"),
            background: tokenColor("surface-hover"),
        },
        selected: {
            text: tokenColor("gold-fg"),
            background: tokenColor("gold"),
        },
        disabled: {
            text: tokenColor("fg-muted"),
            background: tokenColor("surface-elevated"),
        },
        shadow: "var(--shadow)",
        border: tokenColor("line-strong"),
        sideMenu: tokenColor("fg-muted"),
        highlights,
    },
    borderRadius: 6,
    fontFamily: "Inter, sans-serif",
};
