/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: { extend: {} },
    plugins: [],
    corePlugins: {
        // Disable Tailwind's preflight reset — it conflicts with Mantine/BlockNote's own
        // CSS reset and causes editor styles (buttons, dropdowns, lists) to break.
        preflight: false,
    },
};
