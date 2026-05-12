/** @type {import('tailwindcss').Config} */
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
                    base: "#171717",
                    elevated: "#1f1f1f",
                    overlay: "#262626",
                    hover: "#303030",
                },
                border: "#2a2a2a",
                accent: {
                    blue: "#3b82f6",
                },
                text: {
                    primary: "#e5e5e5",
                    secondary: "#d4d4d4",
                    disabled: "#525252",
                },
            },
        },
    },
    plugins: [],
    corePlugins: {
        preflight: true,
    },
};
