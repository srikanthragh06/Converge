# Converge Roadmap: v0.01 → v0.2+

Single-doc scope through v0.1. Multi-doc, auth, document library, access control, and security hardening planned for v0.11–v0.16.

---

## v0.01 — Repo Scaffold ✅
**Goal:** Empty project compiles and boots. Nothing functional yet.
**Branch:** `scaffold` | **Status:** COMPLETE

### Delivered
- Monorepo structure: `web/`, `server/`
- `web/`: React + Vite + TypeScript — BlockNote, Yjs, Socket.IO client, Jotai, Tailwind installed
- `server/`: Node.js + TypeScript — Socket.IO, Kysely, pg, yjs, cors, dotenv installed
- `docker-compose.yml`: all four services — web, server, postgres 16, redis 7-alpine
- `web/Dockerfile` + `server/Dockerfile`: node:20-alpine, layer-cached npm install, `COPY . .`
- `.dockerignore` in both: excludes `node_modules/` and `dist/`
- `.env` (local dev) and `.env.local` (docker) wired for both web and server
- `vite.config.ts`: `host: true` so Vite binds to 0.0.0.0 inside docker
- `nodemon.json`: watches `src/`, ignores `dist/`, runs via `ts-node`
- Both `npm run dev` commands boot without errors
- Inline comments on all code files

---

## v0.02 — Frontend: Editor Renders ✅
**Goal:** BlockNote editor renders and local editing works. No server involved.
**Branch:** `editor-v0.02` | **Status:** COMPLETE

### Delivered
- `App.tsx`: BlockNote editor wired to module-level `Y.Doc` via `yDoc.getXmlFragment("blocknote")`
- `pasteHandler`: intercepts `text/plain` clipboard and calls `editor.pasteMarkdown()` — AI-generated markdown pastes as formatted blocks
- Full-screen dark layout with header using Tailwind utility classes
- **Tailwind CSS integrated**: `tailwind.config.js`, PostCSS inlined in `vite.config.ts`
- Tailwind preflight disabled (`corePlugins: { preflight: false }`) to avoid Mantine/BlockNote CSS conflicts
- Manual `body { margin: 0 }` reset in `index.css` since preflight is off
- Local typing and editing confirmed working

---

## v0.03 — Core Sync: Two Clients Can Collaborate ✅
**Goal:** Two browser tabs edit the same doc simultaneously and converge in real-time.
**Branch:** `sync-v0.03` | **Status:** COMPLETE

### Delivered
- Server-side `Y.Doc` in memory — authoritative state vector, answers repair requests
- `sync_doc`: 300ms batched client updates → relay-first to room → apply to server Y.Doc with `REMOTE_ORIGIN` tag
- Fully bidirectional repair protocol: both client and server detect buffered ops via `mapsEqual` SV check and request repair from the other side
- `repair_response` relayed to all room clients so every peer receives missing updates
- `useSocket` hook: controls connect/disconnect lifecycle (`autoConnect: false`)
- `useSyncEditorChanges` hook: Y.Doc observer, batching, all sync and repair event handlers
- Typed Socket.IO events via `ClientToServerEvents` / `ServerToClientEvents` interfaces on both sides
- Constants and utilities extracted to separate files (`constants.ts`, `utils.ts`) on both sides
- `safeSocketHandler` prevents uncaught errors from crashing the server process
- No persistence yet — doc resets on server restart

---

## v0.04 — Postgres Persistence ✅
**Goal:** Doc survives server restarts. Updates are durable.
**Branch:** `persistence-v0.04` | **Status:** COMPLETE

### Delivered
- `db/index.ts`: Kysely instance + DB type interfaces + `waitForDb()` retry loop (10×3s for Docker cold start) + `migrate()` creates `snapshots` and `document_updates` tables idempotently on every startup
- `db/persistence.ts`: `saveUpdate()` fire-and-forget insert (logs errors, never throws); `loadDocFromDb()` fetches all rows, merges via `Y.mergeUpdates()` before a single apply — more efficient than per-row loop
- `docStore.ts`: `Map<docId, {yDoc, lastAccess}>` registry; `getDoc()` lazy-loads on first client access and deduplicates concurrent loads via in-flight promise map; `touchDoc()` refreshes lastAccess on every socket event; `startSweeper()` evicts idle docs every 10 min in batches of 50 via `setImmediate` to avoid blocking the event loop
- `main.ts`: async IIFE startup — `waitForDb` → `migrate` → `startSweeper` → `listen`; no eager load at startup
- `sockets/socket.ts`: connection handler is now `async`; calls `getDoc(DOC_ID)` at top of each connection; `touchDoc()` + `saveUpdate()` called in `sync_doc` and `repair_response` handlers
- `snapshot_version` is NULL for all v0.04 inserts; FK constraint deferred to v0.06
- Server `src/` reorganised: `db/` for Kysely client + persistence, `store/` for doc registry, `sockets/` unchanged

---

## v0.05 — Redis Pub/Sub (Horizontal Scaling) ✅
**Goal:** Two server instances stay in sync. Any client on any server sees all updates.
**Branch:** `redis-v0.05` | **Status:** COMPLETE

### Delivered
- `redis/client.ts`: two ioredis instances (`pub` + `sub`) with `lazyConnect: true` — subscriber mode can't run other commands so they must be separate clients
- `redis/index.ts`: `waitForRedis()` retry loop (10×3s, mirrors `waitForDb()`); exports both clients
- `redis/pubsub.ts`: `initPubSub()` attaches single global message handler (called once from `main.ts`); `subscribeDoc()` registers in buffer mode before Postgres load; `goLive()` merges buffered updates via `Y.mergeUpdates()` then applies + broadcasts; `publishUpdate()` latin1 encode for lossless binary→string→binary round-trip over Redis strings; `unsubscribeDoc()` called by sweeper on eviction
- Cold-start gap: subscribe before Postgres load → buffer Redis messages → flush after load — Yjs CRDT deduplication handles any overlap
- `docker-compose.yml`: added `server2` service on port 5001; `web` gets `VITE_SERVER_URL_1` + `VITE_SERVER_URL_2`
- Frontend `?server=2` query param selects which server instance to connect to
- `web/src/vite-env.d.ts` created (`/// <reference types="vite/client" />`) — fixes `import.meta.env` TypeScript errors
- `Socket<S,C>` type annotation on variable (not generics on `io<>` call) — `io()` doesn't accept type arguments
- **SV-based repair detection**: `sync_doc` client → server now carries the client's current SV as second arg; server compares SVs after applying and fires bidirectional repair in one shot (`repair_doc` + `repair_response`) if they differ
- **Relay carries serverSV**: every `sync_doc` relay (local room + Redis-originated) includes the server's current SV; receiving clients compare their post-apply SV against it and self-trigger `repair_doc` if different — apply-before-relay order ensures accuracy
- **Heartbeat reconciliation** (`HEARTBEAT_SYNC` / `HEARTBEAT_SYNCACK` / `HEARTBEAT_ACK`): every 10 s client sends its SV; server replies with diff-for-client + serverSV; client applies diff then sends diff-for-server back; server publishes to Redis, persists, and applies — full bidirectional convergence in one round trip without user interaction

---

## v0.055 — OOP Refactor ✅
**Goal:** Rewrite server in a class-based, dependency-injected style. Eliminate module-level singletons and the circular import.
**Branch:** `refactor-v0.055` | **Status:** COMPLETE

### Delivered
- All functional modules replaced with classes: `Database`, `Persistence`, `RedisClient`, `PubSub`, `DocStore`, `SocketHandler`, `HttpServer`, `App`
- `App` is the composition root — constructs all classes and injects dependencies; no other class knows about every dependency
- Circular import eliminated: `PubSub` receives `SocketIOServer` as a constructor parameter instead of importing `socketServer` from `server.ts`
- `Persistence.saveUpdate()` / `loadDocFromDb()` take `documentId` per-call (not stored as instance state)
- `DocStore.loadDoc()` extracted as a private method — no inline function-in-function
- `HttpServer` separates construction from `listen()` so connection handlers can be wired before the port opens
- Sub-layer types extracted to dedicated files: `db/schema.ts`, `redis/types.ts`, `store/types.ts`
- Retry constants and `sleep` moved to `private static` class members
- Web `src/` also reorganised into `constants/`, `types/`, `utils/`, `sockets/` subdirs
- `main.ts` reduced to ~10 lines
- Zero TypeScript errors after full delete of all procedural files

---

## v0.06 — Postgres Compaction ✅
**Goal:** Postgres update table doesn't grow unboundedly.
**Branch:** `compaction-v0.06` | **Status:** COMPLETE

### Delivered
- New `document_meta` table: one row per document, tracks `update_count` (monotonic) and `last_compact_count` (last compacted threshold)
- `Persistence.saveUpdate()` is now a transaction: insert update row + UPSERT counter atomically; returns `{ count, lastCompactCount }` so the caller can check whether compaction is needed
- `Compactor` class owns all persistence + compaction logic — `SocketHandler` calls `compactor.saveAndMaybeCompact()` and no longer imports `Persistence` directly
- Compaction trigger: when `floor(count / 500) * 500 > last_compact_count`, a `setTimeout(0)` fires `compact()` off the hot path
- `compact()` acquires a Redis NX lock (`lock:compact:<documentId>`, 30s TTL), snapshots `MAX(id)`, loads all rows up to that point, calls `Y.mergeUpdates()`, then in one DB transaction: inserts the merged row, deletes the originals, updates `last_compact_count = threshold`; `update_count` is never touched during compaction
- Index on `document_updates.document_id` for efficient range queries
- No S3 — all state lives in Postgres; `snapshots` table and `snapshot_version` column removed

---

## v0.065 — Container / Directory Refactor ✅
**Goal:** Flatten server source layout — one `services/` directory for all service classes, shared types and utils in their own directories, `servicesStore` as a global module (no constructor injection).
**Branch:** `refactor-v0.065` | **Status:** COMPLETE

### Delivered
- Constructor DI replaced with global `servicesStore` module: all services access dependencies via `import { servicesStore }` — no constructor parameters on any service class
- `constants.ts` dissolved — each constant moved to the service that owns it (e.g. `COMPACTION_THRESHOLD` lives in `CompactorService`)
- All service classes consolidated from scattered per-layer dirs (`db/`, `redis/`, `sockets/`, `store/`, root) into `server/src/services/`
- All shared types (DocEntry, SubEntry, SaveUpdateResult, socket event interfaces, TypedSocket) consolidated into `server/src/types/types.ts`
- `utils.ts` moved into `server/src/utils/utils.ts`
- `servicesStore.ts` moved from root into `server/src/store/servicesStore.ts`
- All import paths updated across the codebase
- Zero TypeScript errors after restructure

---

## v0.066 — Responsibility Refactor ✅
**Goal:** Each service owns exactly the state and logic it should. Redis subscription lifecycle moves into `YDocStoreService`. `PubSubService` becomes pure infrastructure. Kysely Migrator replaces inline DDL. Persist deferred past relay in `sync_doc`.
**Branch:** `refactor-v0.066` | **Status:** COMPLETE

### Delivered
- `YDocStoreService` owns all Redis subscription lifecycle: `yDocRedisSubEntries` map (renamed from `subs`), `subscribeYDocToRedis`, `activateYDocRedisChannel`, `publishYDocUpdate`, `unsubscribeYDocFromRedis`, `handleRedisDocumentUpdate` — doc-scoped state co-located with doc-scoped logic
- `PubSubService` reduced to pure infrastructure: `init()` + `handleDocumentUpdateMessage()` (prefix-strip + delegate) — no Yjs imports, no per-doc state
- `DOCUMENT_UPDATE_CHANNEL` public static on `PubSubService`; `YDocStoreService` references it for channel name construction
- Kysely `Migrator` + `FileMigrationProvider` in `DatabaseService.migrate()` — migration files under `server/src/migrations/`; `1_init.ts` created with `up`/`down`; FK constraint: `document_updates.document_id → document_meta.document_id`
- `REMOTE_ORIGIN` + `REDIS_OK` constants moved to shared `constants/constants.ts`
- `handleSyncDoc` now defers Postgres persist to after relay — DB write no longer blocks the relay path
- `handleHeartbeatAck` relays recovered diff to local room clients before applying — same-instance clients have the same gap
- Broad method rename pass: `DocStoreService` → `YDocStoreService`, `getDoc` → `getYDocByDocID`, `saveUpdate` → `saveYDocUpdate`, `loadDocFromDb` → `loadYDocFromDb`, `goLive` → `activateYDocRedisChannel`, `subscribeDoc` → `subscribeYDocToRedis`, etc.

---

## v0.07 — UI Polish ✅
**Goal:** Users can see sync state and connection quality at a glance.
**Branch:** `ui-v0.07` | **Status:** COMPLETE

### Delivered
- Darker navbar (`#111111`) distinct from the editor background
- Custom `socket_ping` / `socket_pong` events: client probes every 5s, server echoes timestamp, client computes RTT
- Ping indicator: colored dot (green/yellow/red) + `Nms` value; `isSocketConnectedAtom` ensures first probe fires on connect not after first interval tick
- Sync status: "Restoring sync" and "Applying updates" messages with animated trailing dots and fade in/out transitions
- Flash pattern: both indicators use a minimum display window (1200ms) so fast cycles are still visible; timer resets on each new trigger
- Jotai atoms for all UI state (`isSocketConnectedAtom`, `pingMsAtom`, `isRestoringSyncAtom`, `isApplyingUpdatesAtom`)
- Components: `AnimatedDots`, `PingDot`, `SyncStatus`, `Navbar` — one component per file
- `<Provider>` in `main.tsx`

---

## v0.08 — Robustness Pass + Offline Support ✅
**Goal:** Edge cases handled, no known failure modes. Client edits survive offline periods.
**Branch:** `offline-v0.08` | **Status:** COMPLETE

### Delivered
- **IndexedDB persistence** via `y-indexeddb`: all Y.Doc updates (local and remote) are automatically persisted to IndexedDB; on page load the local snapshot is applied before server sync so no edits are lost
- **Offline-aware sync gate**: initial `repair_doc` and heartbeat are gated on `isIndexedDBSynced` — the server only receives the client SV after the local snapshot has been loaded, preventing stale SVs from triggering unnecessary repairs
- **Offline UI**: navbar shows a zinc offline badge when the socket is disconnected, replacing the ping indicator
- **Stale ping cleared on disconnect**: `pingMsAtom` resets to `null` on disconnect so the UI never shows an outdated latency value
- `isIndexedDBSynced` state in `useSyncEditorChanges` gates both the connect effect and the heartbeat interval
- `INDEXEDDB_DOC_NAME = "1"` constant scoped inside the hook

---

## v0.09 — Multi-Document Support ✅
**Goal:** Users can create and access distinct documents via URL. Each doc is isolated.
**Branch:** `multi-doc-v0.09` | **Status:** COMPLETE

### Delivered
- **React Router**: `/note/:documentId` route; unknown paths render `NotFoundPage`
- **Join/leave doc protocol**: new `join_doc` / `joined_doc` / `leave_doc` / `left_doc` socket events; client gates all sync operations on `joined_doc` confirmation
- **`socket.data.documentId`**: server stores validated numeric documentId in socket.data after join; all sync handlers read from there with `if (socket.data.documentId === undefined) return` guard
- **Auto-provision**: `PersistenceService.createDocIfDoesntExist()` called on `join_doc` so `document_meta` row exists before any update lands
- **Removed hardcoded IDs**: `SocketHandlerService.DOC_ID` and `YDocStoreService.DOCUMENT_ID` constants eliminated; `String(documentId)` used inline as the socket room key
- **Per-doc IndexedDB**: `INDEXEDDB_DOC_NAME` is now `String(documentId)` — each document has its own offline snapshot
- **`EditorPage`**: extracts `documentId` from URL params, creates a per-mount `Y.Doc`, calls all sync hooks with `documentId`
- **`NotFoundPage`**: rendered for unknown routes and invalid documentId URL params
- `useSyncEditorChanges` emits `join_doc` on socket connect, tracks `isDocJoined` locally, gates repair_doc and heartbeat on `isDocJoined` instead of `isSocketConnected`

---

## v0.1 — Google Auth (Forced) ✅
**Goal:** Only authenticated Google users can access the app. No anonymous editing.
**Branch:** `auth-v0.10` | **Status:** COMPLETE

### Delivered
- Google OAuth 2.0 via Supabase (`signInWithOAuth`); no custom server OAuth routes needed
- `POST /auth/verifyGoogleAuth`: verifies Supabase token, upserts user in DB, issues httpOnly JWT cookie
- `GET /auth/me`: verifies JWT cookie and returns user profile — used by `useAuth` on mount
- `users` table: serial integer PK, `email` unique + indexed, `display_name`, `avatar_url`
- `AuthService`: `signJwt(payload, expiresIn)` + `verifyJwt(token)` — JWT logic co-located with Supabase token verification
- `upsertUser` in `PersistenceService`: `ON CONFLICT (email) DO UPDATE` — no separate UserService
- Socket.IO JWT middleware (`handleSocketMiddleware`): parses `token` cookie from handshake headers, attaches `socket.data.user`; `assertAuthed()` guard in all sync handlers
- CORS `credentials: true` with `WEB_URL` origin; `withCredentials: true` on axios and Socket.IO client
- `AuthOverlay`: full-screen backdrop shown when `isAuthedAtom=false`; passes `?from=<pathname>` in OAuth redirectTo; placed in pages that require auth
- `AuthCallbackPage`: reads `?from=`, verifies, sets auth atoms, shows `AnimatedDots` then navigates back
- `useAuth` + `useSocket` moved to `App.tsx`; socket only connects after `isAuthedAtom=true`

---

## v0.11 — Document Title ✅
**Goal:** Each document has an editable title, persisted and displayed in the UI.
**Branch:** `title-v0.11` | **Status:** COMPLETE

### Delivered
- Migration `3_document_title.ts`: adds `title TEXT NOT NULL DEFAULT ''` to `document_meta`
- `GET /documents/:documentId`: returns `{ id, title }` metadata — auth required
- `PATCH /documents/:documentId/title`: updates title, auth required, Zod validation (max 32 chars) via `ValidationService`
- `ValidationService`: dedicated class for Zod request body schemas
- `requireAuth()` private helper in `ControllerService` DRYs up JWT cookie checks across all routes
- `GET /auth/me` now confirms the user still exists in the `users` table (not just JWT validity)
- `PersistenceService`: added `getDocumentMeta()`, `updateDocumentTitle()`, `getUserByEmail()`
- `sync_title` Socket.IO event: PATCH publishes new title to Redis (`TITLE_UPDATE_CHANNEL`) so all servers broadcast to their local clients — cross-server real-time sync
- `YDocStoreService`: subscribes/unsubscribes each doc to both `DOCUMENT_UPDATE_CHANNEL` and `TITLE_UPDATE_CHANNEL`; `publishTitleUpdate()` + `handleRedisTitleUpdate()`
- `PubSubService`: routes `TITLE_UPDATE_CHANNEL` messages alongside `DOCUMENT_UPDATE_CHANNEL`
- `DocumentTitle` component: `text-6xl font-bold`, debounced PATCH (500ms), `isSaving` dim while in-flight, `isTitleSyncing` dim (500ms) on remote `sync_title`, disabled with visual feedback when not joined
- `useSyncEditorChanges`: fetches title via `GET /documents/:id` on `joined_doc`; listens for `sync_title`; returns `{ title, isDocJoined, isTitleSyncing }`
- Initial bidirectional sync on join now uses heartbeat (not one-shot `repair_doc`) — covers both client→server and server→client missed updates in one round trip

---

## v0.12 — Document Library
**Goal:** Users can see all their documents and create or delete them from a dashboard.

- New `/library` route — full-page document list view
- Library table columns: document title, created by, last edited at
- "New document" CTA — creates a `document_meta` row, redirects to `/note/:docId`
- Delete document — confirm dialog; removes all `document_updates` rows and the `document_meta` row in a transaction
- `document_meta` extended: add `created_by` (FK to `users`), `created_at`, `last_edited_at` (updated on every `saveYDocUpdate`)

---

## v0.13 — Access Management
**Goal:** Document owners control who can view or edit each document.

- New `document_access` table: `(document_id, user_id, role ENUM('owner','editor','viewer'))`
- Owner set to the creating user at doc creation time
- Owner can invite other users by email (lookup in `users` table); assign `editor` or `viewer` role
- Viewer role: socket connection allowed, edits rejected server-side; editor role: full sync
- Frontend: share button → modal with user list + role picker
- Library page filtered to docs where the current user has any access role

---

## v0.14 — Security & Robustness Hardening
**Goal:** Production-grade safety — no single bad request can take the server down or abuse resources.

- **Rate limiting**: express-rate-limit on all REST routes; per-socket event rate limits in socket handlers (drop events exceeding threshold)
- **Input validation**: validate all socket payloads — binary length cap on Yjs updates, docId must be a positive integer — with Zod or hand-rolled guards
- **Error boundaries**: every async path wrapped in try/catch with structured logging; audit `safeSocketHandler` usage for gaps
- **Auth on every surface**: re-verify session on every socket event (not just at connection time); reject stale sessions mid-session
- **DoS protection**: max payload size on express body parser; socket.io `maxHttpBufferSize` set explicitly
- **Graceful shutdown**: SIGTERM handler drains in-flight requests, closes DB and Redis connections cleanly
- **Structured logging**: replace `console.log/error` with a levelled logger (e.g. `pino`) across all services
