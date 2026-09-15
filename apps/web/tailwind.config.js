/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from "tailwindcss-animate";

export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["'Roboto'", "sans-serif"],
                montserrat: ["'Montserrat'", "sans-serif"],
            },
            // Mirror src/theme/colors.ts so the same palette is available as Tailwind classes.
            colors: {
                background: {
                    DEFAULT: "hsl(var(--background))",
                    base: "#171717",
                    elevated: "#1f1f1f",
                    overlay: "#262626",
                    hover: "#303030",
                },
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                border: "#2a2a2a",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                accent: {
                    blue: "#3b82f6",
                },
                text: {
                    primary: "#e5e5e5",
                    secondary: "#d4d4d4",
                    disabled: "#525252",
                    white: "#ffffff",
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
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
        },
    },
    plugins: [tailwindcssAnimate],
    corePlugins: {
        preflight: true,
    },
};
