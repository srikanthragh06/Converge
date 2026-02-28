# Converge Roadmap: v0.01 → v0.1

Single-doc scope throughout. Auth, awareness, offline support, and auto-scaling are all deferred to v0.11+.

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

## v0.05 — Redis Pub/Sub (Horizontal Scaling)
**Goal:** Two server instances stay in sync. Any client on any server sees all updates.

- Redis connection setup
- On `sync_doc` from a client: publish raw Yjs binary to Redis channel `doc:1`
- Redis subscriber: relay to local clients, apply to local Y.Doc — never re-publish to Redis
- Cold-start gap handling: subscribe to Redis *before* loading from Postgres, buffer messages during load, apply buffer after (Yjs deduplication handles overlap)
- Test: run two server instances, connect a client to each, confirm edits propagate

---

## v0.06 — S3 Snapshots + Compaction
**Goal:** Postgres update table doesn't grow unboundedly.

- S3 client setup (MinIO in docker-compose for local dev)
- Background async snapshot job:
  1. Acquire Redis lock (`snapshot:lock:doc-1`)
  2. Encode full Y.Doc: `Y.encodeStateAsUpdate(serverDoc)`
  3. Upload binary to S3, record key in `snapshots` table
  4. Subsequent Postgres inserts reference the new `snapshot_version`
  5. Release lock
- Trigger: after each write, if update count for current snapshot > 10K → fire-and-forget snapshot job
- On server startup: load latest snapshot from S3 first, then replay only updates where `snapshot_version = latest_snapshot.id`

---

## v0.07 — Robustness Pass
**Goal:** Edge cases handled, no known failure modes.

- Reconnection: client drops and reconnects, `repair_doc` returns correct diff
- Server restart with populated DB + snapshot: doc loads correctly
- Rapid concurrent edits from 3+ clients: all converge
- Redis pub/sub disconnect/reconnect: server re-subscribes
- Double-compaction: Redis lock prevents it, second attempt is a no-op

---

## v0.08 — UI Polish
**Goal:** Users can see sync state, latency, and connectivity.

- Sync status indicator: `SAVED` / `SAVING...` / `FAILED`
- Ping/latency display (ping/pong events)
- Online/offline badge

---

## v0.09 — Docker Compose Polish
**Goal:** One command starts the full stack.

- MinIO service in docker-compose
- All env vars documented and wired through compose
- Health checks on server, postgres, redis
- `README.md` with setup instructions

---

## v0.1 — Stable Milestone
**Goal:** End-to-end working, documented, ready for v0.11+ scope expansion.

- CLAUDE.md updated with implementation learnings
- All services start cleanly from `docker-compose up`
- Manual end-to-end test: open 3 clients, edit concurrently, disconnect one, reconnect, confirm convergence
