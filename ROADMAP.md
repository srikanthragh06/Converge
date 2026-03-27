# Roadmap

## v0.01 — Project Scaffolding ✅

> Branch: `v0.01-project-scaffolding`

### Web (React frontend)
- Vite + React 19 + TypeScript
- Tailwind CSS v4 (CSS-first config, `@tailwindcss/vite` plugin)
- System font stack as default body font
- Strict TypeScript (`strict: true`)

### Server (NestJS backend)
- NestJS + TypeScript with strict mode
- Socket.io ready (`@nestjs/platform-socket.io` installed)
- `@nestjs/config` + `dotenv` for environment-based config (`.env.<NODE_ENV>`)
- Global exception filter with proper HTTP status code preservation
- Process-level error handlers (`unhandledRejection`, `uncaughtException`)
- `ApiResponse<T>` envelope for consistent API response shapes
- `GET /health` endpoint

### Tooling
- Prettier configured for both `web/` and `server/`
- Claude Code hook blocking access to `.env` files
- `review-and-commit` skill for reviewing and committing changes

---

## Upcoming
