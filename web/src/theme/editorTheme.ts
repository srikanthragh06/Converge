import { type ColorScheme } from "@blocknote/mantine";

// Custom dark theme built around #171717 as the base background.
// Each surface steps slightly lighter to create depth without harsh contrast.
export const convergeTheme: Partial<{
    colors: ColorScheme;
    borderRadius: number;
    fontFamily: string;
}> = {
    colors: {
        editor: { text: "#e5e5e5", background: "#171717" },
        menu: { text: "#e5e5e5", background: "#161616" },
        tooltip: { text: "#d4d4d4", background: "#404040" },
        hovered: { text: "#ffffff", background: "#303030" },
        selected: { text: "#ffffff", background: "#3b82f6" },
        disabled: { text: "#525252", background: "#1f1f1f" },
        shadow: "#00000060",
        border: "#2a2a2a",
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
    },
    borderRadius: 6,
    fontFamily: "Inter, sans-serif",
};
