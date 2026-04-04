import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    // Inline PostCSS config — more reliable than postcss.config.js with Vite's ES module handling.
    css: {
        postcss: {
            plugins: [tailwindcss(), autoprefixer()],
        },
    },
    optimizeDeps: {
        // shared is a local workspace package — Vite skips its normal CJS→ESM
        // conversion for these, so we force it to include shared explicitly.
        include: ['@converge/shared'],
    },
    server: {
        // host: true binds Vite to 0.0.0.0 so it's reachable from outside the
        // container when running via docker-compose. Safe to keep for local dev too.
        host: true,
        // PORT env var allows docker-compose to run multiple web instances on
        // different ports without separate Dockerfiles. Falls back to 5173 locally.
        port: process.env.PORT ? Number(process.env.PORT) : 5173,
    },
});
