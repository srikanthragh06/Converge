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
