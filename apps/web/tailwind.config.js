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
            // Entrance animations for overlays and popups (components/ui).
            keyframes: {
                "fade-in": { from: { opacity: "0" } },
                "modal-in": {
                    from: { opacity: "0", transform: "translateY(4px) scale(0.98)" },
                },
                "sheet-in": { from: { transform: "translateY(100%)" } },
                "drawer-in": { from: { transform: "translateX(-100%)" } },
                "panel-in": { from: { transform: "translateX(100%)" } },
            },
            animation: {
                "fade-in": "fade-in 150ms ease-out",
                "modal-in": "modal-in 150ms ease-out",
                "sheet-in": "sheet-in 220ms cubic-bezier(0.32, 0.72, 0, 1)",
                "drawer-in": "drawer-in 220ms cubic-bezier(0.32, 0.72, 0, 1)",
                "panel-in": "panel-in 220ms cubic-bezier(0.32, 0.72, 0, 1)",
            },
        },
    },
    corePlugins: {
        preflight: true,
    },
};
