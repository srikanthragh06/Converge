/** @type {import('tailwindcss').Config} */
import { TOKEN_NAMES, themes } from "./src/theme/colors.ts";

/**
 * Maps every semantic token to a color that reads its CSS variable (see
 * src/theme/themeVariables.ts), so classes like `bg-surface-elevated` follow
 * the active theme. Hex tokens are stored as RGB channels and support
 * opacity modifiers; other values (the rgba overlay and shadow) are used as-is.
 */
const tokenColors = Object.fromEntries(
    TOKEN_NAMES.map((name) => [
        name,
        themes.dark.tokens[name].startsWith("#")
            ? `rgb(var(--${name}) / <alpha-value>)`
            : `var(--${name})`,
    ]),
);

export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        // The palette is only the theme tokens — Tailwind's default colors
        // (white, gray-700, red-400, ...) are deliberately not available.
        colors: {
            transparent: "transparent",
            current: "currentColor",
            inherit: "inherit",
            ...tokenColors,
        },
        extend: {
            // UI text is Inter; display text (document title, headings, modal and page titles) is Newsreader.
            fontFamily: {
                sans: ["Inter", "sans-serif"],
                serif: ["Newsreader", "Georgia", "serif"],
            },
            // Defaults for a bare `border` / `ring`, which otherwise come from the removed default palette.
            borderColor: { DEFAULT: tokenColors.line },
            ringColor: { DEFAULT: tokenColors.gold },
        },
    },
    corePlugins: {
        preflight: true,
    },
};
