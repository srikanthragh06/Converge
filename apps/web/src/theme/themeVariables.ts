import { HIGHLIGHT_NAMES, TOKEN_NAMES, themes, type ThemeMode } from "./colors";

/**
 * Converts a token value to its CSS variable form: "#rrggbb" becomes
 * space-separated RGB channels ("21 25 34") so it can be wrapped in
 * `rgb(var(--x) / <alpha>)`; any other value (e.g. an rgba overlay) is kept as-is.
 * @param value - a hex color or any other CSS color string
 * @returns the value to store in the CSS variable
 */
const toVariableValue = (value: string): string => {
    const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
    if (!hex) return value;
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
};

/**
 * Builds the CSS variable declarations for one theme: every semantic token
 * as `--<token>`, and every BlockNote highlight as `--highlight-<name>` /
 * `--highlight-<name>-bg`.
 * @param mode - the theme to build
 * @returns the declarations, one per line
 */
const buildDeclarations = (mode: ThemeMode): string => {
    const { tokens, highlights } = themes[mode];

    // Semantic tokens.
    const lines = TOKEN_NAMES.map(
        (name) => `--${name}: ${toVariableValue(tokens[name])};`,
    );

    // BlockNote highlight palette.
    for (const name of HIGHLIGHT_NAMES) {
        lines.push(
            `--highlight-${name}: ${toVariableValue(highlights[name].text)};`,
            `--highlight-${name}-bg: ${toVariableValue(highlights[name].background)};`,
        );
    }
    return lines.join("\n");
};

/**
 * Injects a stylesheet defining every theme variable under
 * `:root[data-theme="dark"]` and `:root[data-theme="light"]`. The active set
 * is chosen by the `data-theme` attribute on <html>, which the inline script
 * in index.html sets before this runs and useThemeSync keeps current.
 * Call once, before the first render.
 */
export const injectThemeVariables = () => {
    const style = document.createElement("style");
    style.id = "theme-variables";
    style.textContent = (["dark", "light"] as const)
        .map(
            (mode) =>
                `:root[data-theme="${mode}"] {\n${buildDeclarations(mode)}\n}`,
        )
        .join("\n");
    document.head.appendChild(style);
};
