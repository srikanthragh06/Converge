// Single source of truth for all colour values in the app.
// Reference these tokens in editorTheme.ts and as Tailwind classes — never hardcode hex values elsewhere.
export const colors = {
    background: {
        base: "#171717",
        elevated: "#1f1f1f",
        overlay: "#262626",
        hover: "#303030",
    },
    border: "#2a2a2a",
    shadow: "#00000060",
    text: {
        primary: "#e5e5e5",
        secondary: "#d4d4d4",
        disabled: "#525252",
        white: "#ffffff",
    },
    accent: {
        blue: "#3b82f6",
    },
    tooltip: {
        background: "#404040",
    },
    highlights: {
        gray: { text: "#a3a3a3", background: "#262626" },
        brown: { text: "#c4a882", background: "#2e2520" },
        red: { text: "#f87171", background: "#2c1515" },
        orange: { text: "#fb923c", background: "#2c1a0e" },
        yellow: { text: "#fbbf24", background: "#2c2210" },
        green: { text: "#4ade80", background: "#0f2a1a" },
        blue: { text: "#60a5fa", background: "#0f1f2e" },
        purple: { text: "#c084fc", background: "#1e1030" },
        pink: { text: "#f472b6", background: "#2c1020" },
    },
} as const;

/** The app's two color themes. Dark is the default. */
export type ThemeMode = "dark" | "light";

/** BlockNote highlight color names, shared by the text-color and background-color menus. */
export const HIGHLIGHT_NAMES = [
    "gray",
    "brown",
    "red",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
] as const;

/** One BlockNote highlight color name. */
export type HighlightName = (typeof HIGHLIGHT_NAMES)[number];

/**
 * Semantic color tokens for one theme. Each key becomes a CSS variable
 * (`--<key>`) and a Tailwind color class (`bg-<key>`, `text-<key>`, ...).
 * Hex values are stored as RGB channels in their CSS variable so Tailwind's
 * opacity modifiers (`bg-gold/20`) work; non-hex values are used verbatim.
 */
type ThemeTokens = {
    /** Page and editor background. */
    surface: string;
    /** Sidebar background. */
    "surface-sidebar": string;
    /** Modals, menus, popovers, dropdown panels. */
    "surface-elevated": string;
    /** Inputs, selects, and cards sitting inside an elevated surface. */
    "surface-inset": string;
    /** Active sidebar row, pressed icon button, banners, selected list item. */
    "surface-selected": string;
    /** Row and menu-item hover. */
    "surface-hover": string;
    /** Segmented-control track and code-block background. */
    "surface-track": string;
    /** Header bottom edge and table row separators. */
    "line-subtle": string;
    /** Sidebar edge, section and menu separators. */
    line: string;
    /** Input, select, outline-button, and menu outlines. */
    "line-strong": string;
    /** Titles, headings, nav items, menu items. */
    fg: string;
    /** Body copy, list rows, header icons. */
    "fg-secondary": string;
    /** Labels, subtitles, shortcuts, help text, section headers. */
    "fg-muted": string;
    /** Gold accent: primary buttons, active markers, focus ring. */
    gold: string;
    /** Text and icons placed on a gold fill. */
    "gold-fg": string;
    /** Saved / up-to-date status dots. */
    success: string;
    /** Destructive text and icons. */
    danger: string;
    /** Filled destructive button background. */
    "danger-solid": string;
    /** Text on a filled destructive button. */
    "danger-solid-fg": string;
    /** Background of an added block in a diff. */
    "diff-added": string;
    /** Text of an added block in a diff, and the +N count. */
    "diff-added-fg": string;
    /** Background of a removed block in a diff. */
    "diff-removed": string;
    /** Text of a removed block in a diff, and the −N count. */
    "diff-removed-fg": string;
    /** Tooltip chip background (inverted against the surface). */
    tooltip: string;
    /** Tooltip chip text. */
    "tooltip-fg": string;
    /** Modal backdrop, including its own alpha. */
    overlay: string;
};

/** Text and background color for one BlockNote highlight. */
type HighlightColor = { text: string; background: string };

/** A full color theme: semantic tokens plus the BlockNote highlight palette. */
type Theme = {
    tokens: ThemeTokens;
    highlights: Record<HighlightName, HighlightColor>;
};

/**
 * Both color themes. Token values were sampled from the redesign mockups
 * (Converge doc 118, "Design tokens"); dark `danger*` and the `diff-removed*`
 * pair are derived, since the mockups never render them.
 */
export const themes: Record<ThemeMode, Theme> = {
    dark: {
        tokens: {
            surface: "#151922",
            "surface-sidebar": "#12171d",
            "surface-elevated": "#1d2331",
            "surface-inset": "#151922",
            "surface-selected": "#222939",
            "surface-hover": "#1b1f2a",
            "surface-track": "#0f1219",
            "line-subtle": "#1f232e",
            line: "#222933",
            "line-strong": "#323945",
            fg: "#e7e5dd",
            "fg-secondary": "#babdc6",
            "fg-muted": "#8f94a1",
            gold: "#d4aa5e",
            "gold-fg": "#201303",
            success: "#7cc299",
            danger: "#e8836f",
            "danger-solid": "#c4523e",
            "danger-solid-fg": "#fbeee9",
            "diff-added": "#22392d",
            "diff-added-fg": "#a4d2b7",
            "diff-removed": "#3b2429",
            "diff-removed-fg": "#eca394",
            tooltip: "#e9e6dd",
            "tooltip-fg": "#131315",
            overlay: "rgb(0 0 0 / 0.45)",
        },
        highlights: {
            gray: { text: "#a3a3a3", background: "#262a33" },
            brown: { text: "#c4a882", background: "#2e2520" },
            red: { text: "#f87171", background: "#2c1515" },
            orange: { text: "#fb923c", background: "#2c1a0e" },
            yellow: { text: "#fbbf24", background: "#2c2210" },
            green: { text: "#4ade80", background: "#0f2a1a" },
            blue: { text: "#60a5fa", background: "#0f1f2e" },
            purple: { text: "#c084fc", background: "#1e1030" },
            pink: { text: "#f472b6", background: "#2c1020" },
        },
    },
    light: {
        tokens: {
            surface: "#f9f8f4",
            "surface-sidebar": "#eeebe4",
            "surface-elevated": "#ffffff",
            "surface-inset": "#f9f8f4",
            "surface-selected": "#e4e0d5",
            "surface-hover": "#e9e6dd",
            "surface-track": "#f3f2ed",
            "line-subtle": "#e9e6df",
            line: "#dfdcd3",
            "line-strong": "#cfcbc1",
            fg: "#1a1c25",
            "fg-secondary": "#3f424c",
            "fg-muted": "#696b72",
            gold: "#946c27",
            "gold-fg": "#fdfbf3",
            success: "#2f7c55",
            danger: "#a44335",
            "danger-solid": "#b13e2b",
            "danger-solid-fg": "#f8eee6",
            "diff-added": "#dcf0e7",
            "diff-added-fg": "#246643",
            "diff-removed": "#f7e3de",
            "diff-removed-fg": "#a44335",
            tooltip: "#1a1d26",
            "tooltip-fg": "#efefee",
            overlay: "rgb(24 26 32 / 0.32)",
        },
        highlights: {
            gray: { text: "#787774", background: "#ebeced" },
            brown: { text: "#64473a", background: "#e9e5e3" },
            red: { text: "#e03e3e", background: "#fbe4e4" },
            orange: { text: "#d9730d", background: "#f6e9d9" },
            yellow: { text: "#b58b00", background: "#fbf3db" },
            green: { text: "#4d6461", background: "#ddedea" },
            blue: { text: "#0b6e99", background: "#ddebf1" },
            purple: { text: "#6940a5", background: "#eae4f2" },
            pink: { text: "#ad1a72", background: "#f4dfeb" },
        },
    },
};

/** Semantic token names, shared by the CSS variable generator and the Tailwind config. */
export const TOKEN_NAMES = Object.keys(
    themes.dark.tokens,
) as (keyof ThemeTokens)[];
