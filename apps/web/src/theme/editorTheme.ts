import { type ColorScheme } from "@blocknote/mantine";
import { colors } from "./colors";

// Custom dark theme built around #171717 as the base background.
// Each surface steps slightly lighter to create depth without harsh contrast.
export const convergeTheme: Partial<{
    colors: ColorScheme;
    borderRadius: number;
    fontFamily: string;
}> = {
    colors: {
        editor: { text: colors.text.primary, background: colors.background.base },
        menu: { text: colors.text.primary, background: colors.background.overlay },
        tooltip: { text: colors.text.secondary, background: colors.tooltip.background },
        hovered: { text: colors.text.white, background: colors.background.hover },
        selected: { text: colors.text.white, background: colors.accent.blue },
        disabled: { text: colors.text.disabled, background: colors.background.elevated },
        shadow: colors.shadow,
        border: colors.border,
        highlights: colors.highlights,
    },
    borderRadius: 6,
    fontFamily: "Inter, sans-serif",
};
