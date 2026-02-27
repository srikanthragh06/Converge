import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default defineConfig({
    plugins: [react()],
    // Inline PostCSS config — more reliable than postcss.config.js with Vite's ES module handling
    css: {
        postcss: {
            plugins: [tailwindcss(), autoprefixer()],
        },
    },
    server: {
        // host: true binds Vite to 0.0.0.0 so it's reachable from outside the
        // container when running via docker-compose. Safe to keep for local dev too.
        host: true,
        port: 5173,
    },
});
