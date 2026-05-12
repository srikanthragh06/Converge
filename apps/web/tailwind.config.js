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
