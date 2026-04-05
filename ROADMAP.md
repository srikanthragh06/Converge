# Roadmap

## v0.01 — Project Scaffolding ✅

> Branch: `project-scaffolding-v0.01`

### Web (React frontend)
- Vite + React 19 + TypeScript
- Tailwind CSS (PostCSS, system font stack)
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

## v0.02 — Web Block Editor ✅

> Branch: `web-block-editor-v0.02`

### Web (React frontend)
- `react-router-dom` v7 with `BrowserRouter` — client-side routing scaffolded
- `DocPage` as the initial route (`/`), shell for the document editor
- BlockNote editor integrated (`@blocknote/core`, `@blocknote/mantine`) with custom paste handler that interprets plain-text pastes as Markdown
- Migrated from Tailwind CSS v4 to v3 — v4's global preflight reset conflicted with Mantine/BlockNote's internal styles; v3 with `preflight: false` resolves the conflict
- PostCSS configured inline in `vite.config.ts` (more reliable than `postcss.config.js` with Vite's ESM handling)
- Centralised color palette in `src/theme/colors.ts` — single source of truth for all color values
- Custom BlockNote theme (`src/theme/editorTheme.ts`) built around `#171717` base, referencing `colors.ts`
- Tailwind config extended with named color tokens (`bg-background-base`, `text-text-primary`, etc.) mirroring `colors.ts`

### Tooling
- Claude Code hook blocking git commands that target `main` directly (checkout, push, switch, merge, rebase, reset)

---

## v0.03 — Real-Time Yjs Document Sync ✅

> Branch: `sync-yjs-doc-v0.03`

### Web (React frontend)
- `useSocket` hook manages the Socket.io connection lifecycle and ping-pong latency measurement
- Connection state lifted to a Jotai atom (`isSocketConnectedAtom`) so hooks and components share a single source of truth
- `DocPage` refactored into `EditorPage` + `useEditor` hook — editor construction and sync logic separated from rendering
- Yjs (`yjs`) integrated into `useEditor`: a shared `Y.Doc` backs the BlockNote editor via the stub collaboration config
- `sync-doc` protocol: local Yjs updates are debounced (300 ms), merged, and emitted to the server with the client state vector; incoming server updates are applied and tagged `"REMOTE"` to prevent echo loops
- Repair sync protocol: on connect and every 5 seconds, the client sends its state vector to the server; mismatches trigger a bidirectional diff exchange that converges both sides
- `add-comments` custom skill for adding inline documentation to unstaged diffs or entire folders

### Server (NestJS backend)
- `DocumentGateway` and `DocumentService` wired up for WebSocket document sync
- HTTP and WebSocket response utilities split into `http-response.util.ts` and `ws-response.util.ts`
- WebSocket CORS origin scoped to `CLIENT_URL` env var instead of a wildcard
- `DocumentService` owns a singleton `Y.Doc`; all Yjs operations (`applyUpdate`, `encodeStateVector`, `encodeStateAsUpdate`) are encapsulated there
- `sync-doc` handler: applies client updates, broadcasts to other clients, triggers repair if the sending client is behind
- Repair sync handlers (`repair-sync-doc`, `repair-sync-ack-doc`, `repair-ack-doc`): full bidirectional diff exchange to reconcile diverged documents

### Documentation
- Inline documentation pass across the entire codebase: JSDoc on all functions and methods, part-by-part comments inside function bodies, trailing comments on class attributes and state variables

---

## v0.04 — Monorepo + Typed Socket Layer ✅

> Branch: `monorepo-config-v0.04`

### Monorepo
- Repo restructured as a pnpm workspace monorepo: `apps/web`, `apps/server`, `packages/shared`
- `packages/shared` (`@converge/shared`) is the single source of truth for types, constants, and utilities shared across apps
- Production build order fixed — `shared` is built before apps
- `exports` field added to `shared/package.json` for a clean single root entry point

### Shared package
- `INTERNAL_SERVER_ERROR_MESSAGE` constant migrated from server to `@converge/shared`
- `WsResponse<T>` envelope type migrated to `@converge/shared`
- Socket event name constants centralised in `@converge/shared/socket/events` — eliminates string duplication and makes renaming safe
- Zod schemas for all Socket.io event payloads (`sync-doc`, repair sync family) co-located in `@converge/shared/socket`
- `socket.ts` organised into labelled sections by event family for readability

### Server
- Repair sync events renamed with explicit `-server`/`-client` suffix convention — disambiguates direction at the event name level
- `socketBroadcast` helper extracted for broadcasting to all clients except the sender

## v0.05 — PostgreSQL Persistence ✅

> Branch: `postgres-setup-v0.05`

### Server (NestJS backend)
- Docker Compose dev config (`docker-compose.dev.yml`) spins up a local PostgreSQL 16 container with a named volume for data persistence
- `DatabaseModule` and `DatabaseService` added — environment-aware connection pooling via `pg`, selecting DEV or PROD credentials from env vars at startup using `ConfigService.getOrThrow`
- Kysely integrated as the type-safe SQL query builder; `DatabaseSchema` defines table shapes so all queries are type-checked at compile time
- `DatabaseService.verifyDBConnection()` retries the connection up to 10 times before throwing, preventing the app from accepting traffic with no database
- `DatabaseService.migrate()` runs all pending Kysely migrations to latest on every startup, keeping the schema in sync with the code
- First migration (`0001_create_document_updates`) creates the `document_updates` table — `bigserial` PK, `bytea` for raw Yjs update payloads, `timestamptz created_at`
- `DocumentService` persists every incoming Yjs update to `document_updates` before applying it to the in-memory doc — DB is written first so a failed apply leaves the doc temporarily behind rather than permanently losing an update; the repair sync protocol reconciles any divergence
- `populateInMemoryYdoc` runs at startup to load all persisted updates, merge them, and apply to the in-memory doc so document state survives server restarts

## v0.06 — Multi-Server Yjs Sync ✅

> Branch: `multi-server-v0.06`

### Server (NestJS backend)
- `RedisService` added — manages two ioredis connections: `pub` for publishing and `sub` for subscribing (Redis subscribe mode prevents regular commands on the same connection)
- `RedisService` generates a unique `clientId` (UUID) at startup, included in every published message so subscribers can skip their own echoed messages and avoid echo loops
- `RedisService.publish()` wraps `pub.publish()`, automatically attaching `clientId` and serialising to JSON; fire-and-forget with error logging so a Redis hiccup never fails the client request
- `RedisService.subscribe()` handles channel filtering, JSON parsing, echo prevention, and malformed message recovery in one place
- `RedisService.verifyRedisConnection()` retries up to 10 times before throwing, consistent with `DatabaseService` behaviour
- `DocumentService.applyYDocUpdate()` publishes each update to Redis after applying so other server instances sync their in-memory docs
- `DocumentService.applyUpdateToMemory()` added — applies a Yjs update to the in-memory doc without persisting to DB or republishing to Redis; used for updates received from Redis
- `DocumentGateway` implements `OnApplicationBootstrap` — subscribes to the Redis document update channel on startup, applies incoming updates via `applyUpdateToMemory`, and broadcasts to all locally connected clients
- `REDIS_EVENTS` constants defined in `apps/server/src/redis/redis.events.ts` — server-only, not in `@converge/shared`
- `uint8ArrayToBase64` and `base64ToUint8Array` helpers added to `apps/server/src/utils/utils.ts` for safe binary-over-JSON serialisation

### Tooling
- `docker-compose.dev.yml` now spins up two server instances (`server-1` on port 5000, `server-2` on port 5001) and two web instances (`web-1` on port 5173, `web-2` on port 5174) for end-to-end multi-server testing
- `apps/server/Dockerfile` and `apps/web/Dockerfile` added — build context is the monorepo root; `packages/shared` is built once during image build then kept up to date via `build:watch` at runtime
- Vite dev server port made configurable via `PORT` env var so multiple web instances can run on different ports from the same image

## v0.065 — Server Error Handling ✅

> Branch: `error-handling-v0.065`

### Server (NestJS backend)
- Audited all server code for async errors that bypass `GlobalExceptionFilter` — the filter only covers the NestJS HTTP/WebSocket pipeline; callbacks and fire-and-forget calls outside it are not protected
- Redis subscriber callback in `DocumentGateway.onApplicationBootstrap` wrapped in try-catch with `console.error` logging — an unhandled throw there would crash the process since it runs outside the pipeline
- `applyYDocUpdate` renamed to `applyDocUpdate` and `applyUpdateToMemory` renamed to `applyDocUpdateToMemory` in `DocumentService` for naming consistency
- Confirmed `RedisService.publish()` already handles its own errors internally; confirmed `verifyRedisConnection` and `populateInMemoryYdoc` are intentional crash-on-failure startup paths

### Tooling
- `review-and-commit` skill updated with an explicit async error handling checklist item: callbacks, event listeners, and fire-and-forget calls outside the NestJS pipeline must have their own try-catch or `.catch()`

## Upcoming
