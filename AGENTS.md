# Converge — Agent Guide

## Project

Full-stack Notion-like app (early stage). See [ROADMAP.md](./ROADMAP.md) for version history.

## Structure

pnpm workspace monorepo. Lockfile: `pnpm-lock.yaml`. Manager: `pnpm@10.33.0`, Node >=20.

- `apps/web/` — React + Vite + Tailwind CSS v3 + BlockNote editor
- `apps/server/` — NestJS + Socket.io + Kysely (pg) + ioredis
- `packages/shared/` (`@converge/shared`) — types, Zod schemas, constants, utilities

Build order: `shared` must be built first (it has no app deps; both apps depend on it).

## Commands

```sh
# Dev (run from root; also need Docker for postgres+redis):
docker compose -f docker-compose.dev.yml up -d postgres redis
pnpm dev:server   # nest start --watch, port 5000
pnpm dev:web      # vite, port 5173

# Production build (shared → web → server):
pnpm build

# Individual package commands:
pnpm --filter @converge/shared build          # tsc
pnpm --filter server start:dev                 # nest start --watch
pnpm --filter web dev                          # vite
pnpm --filter web build                        # tsc -b && vite build

# Lint:
pnpm --filter server lint   # eslint src/ --fix
pnpm --filter web lint      # eslint .
```

There are **no tests** in this repository.

## Key Conventions

- **Env loading**: `.env.<NODE_ENV>` (defaults to `dev`) takes precedence; `.env` is fallback. Loaded by `apps/server/src/utils/env.loader.ts` before NestJS boots.
- **Prettier**: Only configured in `apps/server/.prettierrc` (singleQuote, trailingComma all). Web has no Prettier config.
- **NestJS naming**: kebab-case with type suffix (e.g. `document.service.ts`).
- **Tailwind**: Preflight disabled (`corePlugins.preflight: false`) to avoid Mantine/BlockNote conflicts. Manual resets in `index.css`.
- **Colors**: All defined in `web/src/theme/colors.ts`. Reference them in `editorTheme.ts` and as Tailwind classes. No hardcoded hex elsewhere.
- **State**: Jotai atoms under `web/src/atoms/`. Auth is a single `authAtom`: `{ status: "loading" | "authenticated" | "unauthenticated", user: AuthResponseDto | null }`. Hydrated on mount via `useAuth` (GET /auth/me).
- **Auth gating**: Route-level via `authRequired` prop on `<Page>`. No redirect logic in individual pages.
- **Socket events**: Constants in `@converge/shared/socket/events` (`SOCKET_EVENTS`). Payload schemas in `@converge/shared/socket`. Never hardcode strings in apps.
- **HTTP schemas**: `@converge/shared/http`. Use `ZodHttpValidationPipe` on `@Body()` for validation.
- **Migrations**: `apps/server/src/migrations/<number>_<purpose>.ts`. Each exports `up`/`down`. Kysely table types in `apps/server/src/db/database.schema.ts`.
- **Database**: `DatabaseModule` provides `DatabaseService`. Feature modules must import it explicitly.
- **Redis**: `RedisModule` provides `RedisService`. Channel constants in `server/src/redis/redis.events.ts` (`REDIS_EVENTS`), lock keys in same file (`REDIS_LOCKS`). Server-only — nothing Redis-related in `packages/shared`.
- **Binary data** (Yjs Uint8Array): Base64-encode before JSON serialisation. Use `uint8ArrayToBase64`/`base64ToUint8Array` from `server/src/utils/utils.ts`.
- **Async safety**: Code outside NestJS pipeline (Redis callbacks, setInterval, fire-and-forget) must have its own try-catch. GlobalExceptionFilter only covers HTTP handlers and `@SubscribeMessage`.

## Document Architecture

Three focused services in `DocumentModule`:
- `DocumentService` — CRUD, create, metadata, library queries
- `DocumentAccessService` — resolve/grant/revoke access, default access, ownership transfer
- `DocumentYjsService` — in-memory Y.Doc map, apply updates, compaction

Access resolution is three-tier: **owner row** > explicit `document_access` row > `documents.default_access` fallback. Use `hasAccess(resolved, required)` from `@converge/shared` for ordered comparisons (`ACCESS_RANK`).

Client stores resolved access in `documentAccessAtom` (seeded from document-load response) — read from atom, never pass as prop.

HTTP routes: `/document/*` (DocumentController) and `/document-access/*` (DocumentAccessController).

## Vite Quirks

- PostCSS configured inline in `vite.config.ts` (not `postcss.config.js`)
- `host: true` binds to 0.0.0.0 (required for Docker)
- `PORT` env var makes port configurable (multiple Docker instances)
- `@` alias maps to `src/`
- `@converge/shared` forced in `optimizeDeps.include` (local workspace package)

## Claude Hooks

File `.claude/settings.json` blocks: (1) any tool from reading `.env` files, (2) git commands targeting `main` branch.

## Workspaces (v0.13+)

`WorkspaceModule` (server) and full shared HTTP types already exist. The library UI and folder structure are not yet implemented.
