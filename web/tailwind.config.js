/** @type {import('tailwindcss').Config} */
export default {
  // Scan all TSX/TS files in src/ so Tailwind only ships classes that are actually used
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
