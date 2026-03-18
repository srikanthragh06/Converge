# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Converge

Collaborative text editor. Multi-doc (`/note/:documentId`), React + BlockNote + Yjs frontend, Node.js + Socket.IO backend, Postgres + Redis.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend editor | React + BlockNote + Yjs |
| Frontend state | Jotai |
| Client transport | Socket.IO client |
| Server | Node.js + Socket.IO |
| Persistence | Postgres (incremental updates, in-place compaction) |
| Server-to-server | Redis pub/sub |
| Distributed lock | Redis (compaction) |

---

## Commands

```bash
docker-compose up --build    # start all services (server×2, web, postgres, redis)
docker-compose up            # start without rebuilding images
docker-compose down          # stop and remove containers
```

Services exposed on the host:
- `web` → http://localhost:5173
- `server` → http://localhost:5000
- `server2` → http://localhost:5001 (second node, tests Redis pub/sub horizontal scaling)
- `postgres` → localhost:5432 (`psql -h 127.0.0.1 -p 5432 -U converge -d converge`)
- `redis` → localhost:6379

Env files required before first run: `server/.env`, `web/.env`.

No linter or test runner is configured.

---

## Architecture

- **Server Y.Doc**: held in memory per document; primary job is state vector + repair diffs
- **`sync_doc` order**: Redis publish → apply → relay → persist (deferred); apply-before-relay ensures piggybacked SV is accurate
- **Relay loop prevention**: tag remote applies with `REMOTE_ORIGIN`; update handlers skip that origin
- **SV divergence**: symmetric — both server (on `sync_doc`) and client (on relay) compare SVs and self-trigger `repair_doc`
- **Heartbeat**: client sends SV every 10s; server returns diff + SV; client sends diff back — catches accumulated drift
- **Compaction**: `CompactorService` merges rows at every 500-update threshold; Redis NX lock prevents concurrent compaction
- **Cold start**: subscribe Redis first (buffer mode), load Postgres, apply buffer — handles the gap

---

## WebSocket Protocol

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `join_doc` | client → server | `documentId` | Join a document room |
| `joined_doc` | server → client | `(documentId, accessLevel)` | Confirmed join + role |
| `leave_doc` / `left_doc` | both | — | Leave the room |
| `sync_doc` | client → server | `(update, clientSV)` | Incremental update |
| `sync_doc` | server → client | `(update, serverSV)` | Relayed update |
| `repair_doc` | either | state vector | "Send me what I'm missing" |
| `repair_response` | either | Yjs diff | Computed diff |
| `heartbeat_sync` | client → server | `clientSV` | Periodic reconciliation |
| `heartbeat_syncack` | server → client | `(diffForClient, serverSV)` | Client's missing diff |
| `heartbeat_ack` | client → server | `diffForServer` | Server's missing diff |
| `sync_title` | server → client | `(documentId, title)` | Cross-server title broadcast |

---

## Code Organisation

**Server**
- All services in `server/src/services/` — no constructor injection; deps via `servicesStore`
- `server/src/store/servicesStore.ts` — sole file that calls `new`; exports one `servicesStore` object
- Shared types: `server/src/types/types.ts` (socket events, TypedSocket, AccessLevel, DocumentMember, UserSearchResult)
- Shared constants: `server/src/constants/constants.ts` (REMOTE_ORIGIN, REDIS_OK, ACCESS_LEVEL_RANK, hasAccess)
- DB migrations: `server/src/migrations/` — Kysely Migrator; each file exports `up(db)` and `down(db)`
- Save and compact are separate: `persistenceService.saveYDocUpdate()` → `compactorService.checkAndCompactDocumentUpdates()`
- Validation: `ValidationService` — static Zod schemas; call `schema.safeParse(req.body)` in route handlers

**Frontend**
- One component per file; inline prop types (no standalone interfaces for one-off props)
- Constants inside the component/function that owns them, not at module level
- Page-scoped state stays local (`useState`), not global atoms
- Hooks live in `web/src/hooks/`; each page/component with non-trivial logic gets its own hook

---

## Roadmap

| Version | Goal | Status |
|---|---|---|
| v0.01 | Repo scaffold | ✅ `scaffold` |
| v0.02 | BlockNote editor renders | ✅ `editor-v0.02` |
| v0.03 | Core sync — server Y.Doc, repair protocol | ✅ `sync-v0.03` |
| v0.04 | Postgres persistence | ✅ `persistence-v0.04` |
| v0.05 | Redis pub/sub — horizontal scaling, cold-start gap | ✅ `redis-v0.05` |
| v0.055 | OOP refactor — class-based DI | ✅ `refactor-v0.055` |
| v0.06 | Postgres compaction — in-place merge, Redis lock | ✅ `compaction-v0.06` |
| v0.065 | Container refactor — servicesStore, services/ dir | ✅ `refactor-v0.065` |
| v0.066 | Responsibility refactor — Kysely Migrator, deferred persist | ✅ `refactor-v0.066` |
| v0.07 | UI polish — ping indicator, sync status animations | ✅ `ui-v0.07` |
| v0.08 | Offline support — IndexedDB, offline badge | ✅ `offline-v0.08` |
| v0.09 | Multi-document — join/leave protocol, React Router | ✅ `multi-doc-v0.09` |
| v0.1  | Google Auth — OAuth, JWT cookie, users table | ✅ `auth-v0.10` |
| v0.11 | Document Title — editable, Redis cross-server sync | ✅ `title-v0.11` |
| v0.12 | Document Library — `/library`, Ctrl+P overlay, trigram search, pagination | ✅ `library-v0.12` |
| v0.13 | Access Management — owner/admin/editor/viewer roles, Share UI | ✅ `access-v0.13` |
| v0.14 | Security & Robustness — rate limiting, structured logging, graceful shutdown | |

Full detail: `ROADMAP.md`

---

## Implementation Notes

### v0.13
- **Migration 5**: use raw `sql` template with inline `CHECK (access_level IN (...))` — Kysely `.addColumn()` doesn't support CHECK constraints
- **`createDoc` transaction**: inserts `document_meta` + `document_access` (owner row) atomically
- **`upsertLastViewedAt/EditedAt`**: pure `UPDATE` only — access rows created only via explicit `upsertDocumentAccess`
- **`assertEditorAccess`**: private helper in `SocketHandlerService`; logs warning and returns false (does not disconnect) if access < editor
- **`documentAccessLevel`**: local `useState` in `useSyncEditorChanges` (not a global atom); `isEditorOrAbove` derived inline; added to effect dep arrays so closures capture fresh value
- **Zod `z.enum`**: use `message: "..."` directly — `errorMap` property doesn't exist in the installed version
- **Undo/redo fix**: `undoManager.destroy()` is called when `isDocJoined` flips false (BlockNoteView unmounts). It removes `afterTransactionHandler` from the Y.Doc and the UndoManager from its own `trackedOrigins`. On rejoin, TipTap reuses the dead UndoManager via `state.reconfigure()`. Fix: `useEffect([isDocJoined, editor, yDoc])` re-registers the handler and re-adds the UndoManager to `trackedOrigins` each time the doc is joined
- **React 18 + BlockNote 0.45**: downgraded from React 19 and BlockNote 0.47 for compatibility

### v0.12
- **Compound cursor**: `(lastViewedAt, id)` pair for stable scroll pagination — timestamp alone isn't unique
- **Trigram search**: `pg_trgm` + `gin` index on `title`; `similarity()` for ranked results
- **`useCreateBlockNote` deps**: pass `yDoc` via `useMemo` dep — prevents stale Y.Doc on document switch

### v0.11
- **Title sync**: `PATCH /title` publishes to Redis `TITLE_UPDATE_CHANNEL` (not direct emit) for cross-server broadcast
- **Heartbeat replaces initial `repair_doc`**: achieves bidirectional repair on join (server→client AND client→server)

### v0.1
- **Socket.IO cookie parsing**: `{ parse as parseCookie } from "cookie"` — default import gives undefined
- **`withCredentials: true`** required on both `axiosClient` and Socket.IO client for cross-origin cookies
- **CORS**: `credentials: true` + single `WEB_URL` origin on both Express CORS and Socket.IO CORS

### v0.09
- **`join_doc` emitted from `useSyncEditorChanges`**, not `useSocket` — all doc-lifecycle logic in one hook
- **Sync handlers guard**: `if (socket.data.documentId === undefined) return`
- **`isDocJoined`** local state gates all sync (not `isSocketConnected`)

### v0.05
- **Binary-over-Redis**: `Buffer.from(update).toString("binary")` / `Buffer.from(raw, "binary")` — latin1 is the only lossless byte↔string encoding through Redis pub/sub

### v0.02
- **Tailwind preflight**: disable (`corePlugins: { preflight: false }`) — conflicts with Mantine/BlockNote CSS reset

---

## Reference
- Sibling repo (prior art): `/home/sr1k5/myStuff/panam`
- Full schema reference: `schema.md`
