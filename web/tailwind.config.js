/** @type {import('tailwindcss').Config} */
export default {
  // Scan all TSX/TS files in src/ so Tailwind only ships classes that are actually used
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    // Disable Tailwind's preflight reset — it conflicts with Mantine/BlockNote's own
    // CSS reset and causes styles to break. Utility classes still work fine.
    preflight: false,
  },
};
