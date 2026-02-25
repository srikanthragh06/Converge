import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // host: true binds Vite to 0.0.0.0 so it's reachable from outside the
    // container when running via docker-compose. Safe to keep for local dev too.
    host: true,
    port: 5173,
  },
})
