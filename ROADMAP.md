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

## Upcoming
