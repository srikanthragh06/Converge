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

## v0.07 — Yjs Update Compaction ✅

> Branch: `update-compaction-v0.07`

### Server (NestJS backend)

- `documents` table added (migration `0002_create_documents`) — tracks `update_count` and `last_compact_count` per document to drive threshold-based compaction without a full table scan
- `applyDocUpdate` now runs inside a DB transaction that atomically appends the update and increments `update_count`, keeping the counter in sync with persisted updates
- `compactUpdatesIfRequired` added to `DocumentService` — merges all `document_updates` rows up to the current max id into a single Yjs blob and replaces them atomically; triggered fire-and-forget after each write when `update_count >= last_compact_count + COMPACTION_THRESHOLD`
- Compaction threshold (`COMPACTION_THRESHOLD = 5000`) and lock TTL (`COMPACTION_LOCK_TTL_MS = 1 hour`) extracted as private class constants
- `acquireLock` and `releaseLock` added to `RedisService` using `SET NX PX` and `DEL` — used by compaction to ensure only one server instance compacts at a time
- `REDIS_LOCKS` constants added to `redis.events.ts` alongside `REDIS_EVENTS`
- `applyDocUpdateToMemory` renamed to `applyDocUpdateOnlyToLocalMemory` for clarity — makes explicit that the method only touches this server's in-memory doc

## v0.08 — Google OAuth Authentication ✅

> Branch: `auth-v0.08`

### Web (React frontend)

- `AuthPage` added at `/auth` — generates a random CSRF state token, stores it in `localStorage`, then redirects to Google's OAuth authorisation endpoint
- `AuthCallbackPage` and `useGoogleAuthCallback` hook handle the OAuth return: validate the CSRF state, exchange the authorisation code with the server, store the returned user profile in Jotai atoms, then navigate to the app after a short success delay
- `isAuthAtom` and `userDetailsAtom` added to `atoms/auth.ts` — make the authenticated user's identity available across the app without prop-drilling
- `atoms/atoms.ts` split into domain files: `atoms/auth.ts` and `atoms/socket.ts`
- `AUTH_CSRF_STATE` localStorage key extracted to `constants/constants.ts` to eliminate hardcoded strings
- `withCredentials: true` added to the axios client so the browser sends and receives cookies on cross-origin requests
- 404 Not Found page added

### Server (NestJS backend)

- `AuthModule`, `AuthController`, and `AuthService` added for Google OAuth server-side flow
- `AuthService.authorizeGoogleUserAndGenerateJWT` — exchanges the authorisation code with Google's token endpoint, decodes the ID token, validates required claims (`sub`, `email`, `name`, `picture`), and upserts the user into the `users` table keyed on `google_id` so profile changes stay in sync without duplicates
- `users` table added (migration `0003_create_users`) — `bigserial` PK, unique constraints on `google_id` and `email`, profile fields (`name`, `avatar_url`), `created_at`
- JWT issued via `jsonwebtoken` and set as an `httpOnly`, `sameSite: strict` cookie with a 7-day expiry (`AUTH_EXPIRY_TTL_SECONDS`) — token is never exposed to client-side JS
- `setAuthCookie` and `clearAuthCookie` helpers on `AuthService` centralise cookie configuration so name, flags, and TTL are defined in one place
- `ZodHttpValidationPipe` added for Zod-based validation of HTTP request bodies, distinct from the existing `ZodSocketValidationPipe`
- `credentials: true` added to CORS config so the browser accepts `Set-Cookie` on cross-origin responses
- `httpOK` simplified to return the data payload directly instead of wrapping it in a `{ success: true, data }` envelope

### Shared package

- `GoogleAuthRequestSchema` / `GoogleAuthRequestDto` added to `@converge/shared/http/auth` — shared Zod schema for the auth request body, used by both server validation and client type-checking
- `GoogleAuthResponseSchema` / `GoogleAuthResponseDto` added — shared type for the user profile returned from the auth endpoint

## v0.085 — UI Components & Auth Page Polish ✅

> Branch: `ui-components-v0.085`

### Web (React frontend)

- `AuthPage` redesigned — Montserrat title, subtitle copy, and a styled Google sign-in button (white card with border, shadow, and `FcGoogle` icon from `react-icons`)
- Roboto set as the default sans-serif font app-wide: loaded via Google Fonts, registered as the Tailwind `sans` base, and applied to `body` in `index.css` (manual reset needed since Tailwind preflight is disabled)
- `Page` component extracted to `src/components/Page.tsx` — shared full-viewport flex column shell (`w-screen h-screen flex flex-col overflow-x-hidden`) adopted by all top-level routes, eliminating boilerplate repetition
- Custom scrollbar styling added globally — slim 6px pill-shaped thumb using theme palette colours (`#404040` idle, `#525252` hover) with a transparent track
- BlockNote editor font size reduced to 12px on screens narrower than 640px via a `.bn-default-styles` CSS override

## v0.09 — Multi-Document Support & Auth Integration ✅

> Branch: `multi-doc-v0.09`

### Server (NestJS backend)

- Migrations `0004_add_document_id_to_document_updates` and `0005_add_creator_id_to_documents` add `document_id` (NOT NULL, FK → `documents.id`, ON DELETE CASCADE, indexed) and `creator_id` (NOT NULL, FK → `users.id`, indexed) to their respective tables
- `DocumentService` now holds a `Map<documentId, Y.Doc>` — all sync, persistence, compaction, and in-memory doc management is scoped to `document_id`
- `loadDoc(documentId)` replaces `populateInMemoryYdoc` — lazy-loads and caches a `Y.Doc` on first access, returns the cached instance on subsequent calls
- `createNewDocument(userId)` inserts a new document row owned by the given user and returns its ID
- `getDocumentOfUser(documentId, userId)` returns the document row or throws 404 (not found) / 403 (not owner) — used for HTTP access control and WebSocket connection gating
- `DocumentController` extended with `GET /document/:documentId` (returns metadata) and `POST /document` (creates a document); both require `AuthGuard`
- Redis pub/sub channels and compaction locks are now per-document — `REDIS_EVENTS.documentUpdate(documentId)` and `REDIS_LOCKS.compaction(documentId)`
- `GET /auth/me` added — verifies the auth cookie and returns the authenticated user's profile; used by the client for session hydration on page load
- `verifyAuthToken(authToken)` extracted as a public method on `AuthService` so the WebSocket gateway can reuse JWT verification without an Express `Request` object
- `AuthGuard` added — NestJS guard that calls `verifyReqAuthAndAttachUserToReq` and stamps `userId` on the request; applied at the controller class level
- `DocumentGateway` now verifies the `authToken` cookie on every new connection — parses the raw `Cookie` header using the `cookie` package, calls `verifyAuthToken`, and calls `getDocumentOfUser`; rejects with `disconnect(true)` on any failure
- `credentials: true` added to gateway CORS config so the browser accepts credentials on cross-origin WebSocket upgrades
- Bug fixes: `cookie-parser` middleware registered in `main.ts` (was missing, causing `req.cookies` to be undefined); BigInt type parser changed to `Number` to prevent JSON serialisation crashes on SERIAL columns; `jwt.verify` wrapped in try-catch to return 401 instead of 500

### Web (React frontend)

- `authAtom` replaces `isAuthAtom` + `userDetailsAtom` — unified atom with `{ status: "loading" | "authenticated" | "unauthenticated", user: AuthResponseDto | null }`
- `useAuth` hook added — calls `GET /auth/me` on mount and writes to `authAtom`; handles 401 gracefully without crashing
- `Page` component extended with an `authRequired` prop — renders a loading state while the auth status is resolving and redirects to `/auth` when unauthenticated
- `EditorPage` added at `/document/:documentId` — thin component backed by `useEditor`; renders loading, forbidden (403), and ready states
- `useEditor` extended with document fetch logic — calls `GET /document/:documentId` on mount, sets `documentStatus` (`"loading" | "ready" | "forbidden" | "notFound"`), navigates to `/404` on not found
- `useSocket` extended with a `documentId` param — stamps it onto `socket.io.opts.query` before connecting so the gateway can read it from the handshake; connection is gated on `documentStatus === "ready"` to prevent the gateway receiving an invalid document ID
- `withCredentials: true` added to the shared socket.io client so the browser sends the `authToken` cookie on the WebSocket handshake

### Shared package

- `AuthResponseDto` / `AuthResponseSchema` consolidates `GoogleAuthResponseDto` and `AuthMeResponseDto` into a single shared type
- `GetDocumentResponseDto` / `GetDocumentResponseSchema` added for the `GET /document/:documentId` response (id, creatorId, createdAt)

---

## v0.10 — Document Title ✅

> Branch: `document-title-v0.10`

### Server (NestJS backend)

- Migration `0006_add_title_to_documents` — adds `title text NOT NULL DEFAULT ''` to the `documents` table; default ensures existing rows get an empty title without a backfill
- `applyDocTitleUpdate(documentId, title)` added to `DocumentService` — trims whitespace, enforces a 32-character max, and persists the validated title to the DB
- `handleSyncDocTitleServer` added to `DocumentGateway` — persists the title, acks the sender with the `changeId` for pending-state correlation, and broadcasts the new title to all other clients in the document room
- Redis pub/sub channel `document-title-update:<documentId>` added (`REDIS_EVENTS.documentTitleUpdate`) — subscribed alongside the Yjs update channel on first connection so cross-server title changes are broadcast to all locally connected clients
- `GetDocumentResponseDto` updated to include the `title` field so the client can seed local state on initial fetch

### Shared package

- `SYNC_DOC_TITLE_SERVER`, `SYNC_DOC_TITLE_CLIENT`, `SYNC_DOC_TITLE_ACK` events added to `SOCKET_EVENTS`
- `SyncDocTitleServerSchema`, `SyncDocTitleClientSchema`, `SyncDocTitleAckSchema` Zod schemas added to `@converge/shared/socket`

### Web (React frontend)

- Notion-style title input rendered above the BlockNote editor — full-width, transparent, bold, responsive font size (`text-2xl` mobile, `text-4xl` sm+), left-aligned with the editor content
- `useEditor` extended with `title` state (seeded from the initial `GET /document/:documentId` fetch) and `isTitlePending` state (dims the input while a change is in-flight to the server)
- `handleTitleChange` debounces title emits at 300 ms and assigns a fresh `changeId` per emit for ack correlation — prevents a slow earlier ack from incorrectly clearing the pending state after a later keystroke
- `sync-doc-title-client` listener applies real-time title changes broadcast from other clients
- `sync-doc-title-ack` listener clears `isTitlePending` only when the ack `changeId` matches the most recent emit; stale acks from superseded debounce flushes are ignored
- Browser tab title syncs with the document name: `"<title> — Converge"` while on the editor page, resets to `"Converge"` on unmount so other pages don't inherit the document name
- Favicon updated to `convergeLogo.png`
- `useEditor` refactored into three focused sub-hooks: `useDocumentFetch` (HTTP fetch + status), `useDocumentTitle` (title state, debounced emit, ack, tab title), and `useYjsSync` (Y.Doc, update debounce, repair sync); `useEditor` becomes a thin composition layer
- Inline documentation pass on `EditorPage` and all new hooks — JSDoc on every function, part-by-part comments inside bodies, trailing comments on state variables

---

## v0.11 — Basic Document Library ✅

> Branch: `library-v0.11`

### Server (NestJS backend)

- `document_user_metadata` table added (migration `0007_create_document_user_metadata`) — tracks `last_visited_at` and `last_edited_at` per user per document; composite PK on `(document_id, user_id)` with FK cascade on both
- `last_visited_at` is upserted on every WebSocket connect so the library always reflects when the user last opened each document
- `last_edited_at` is updated on every Yjs content update and title change so the card metadata stays accurate
- `GET /document/library` added — returns the authenticated user's documents ordered by `last_visited_at desc` with keyset pagination using a compound cursor `(lastVisitedAt, id)`; requires `AuthGuard`
- `GET /document/library/search` added — full-text title search using PostgreSQL `pg_trgm` trigram similarity, ordered by similarity score descending; filters out documents with empty titles; requires `AuthGuard`
- Trigram GIN index added on `documents.title` to support fast similarity queries
- Repair sync heartbeat interval slowed from 5 s to 15 s to reduce unnecessary server load

### Web (React frontend)

- `/library` route set as the app's default landing page (`/` and `/library` both render `LibraryPage`)
- `LibraryPage` — sticky search bar (transparent background overlay to prevent bleed-through on scroll), card list, "New Document" button pinned to the bottom on mobile and inline on desktop
- `LibraryDocumentCard` — displays document title, owner name, last-visited time, and last-edited time; navigates to `/document/:id` on click
- `useLibrary` hook — manages search text, document list, and loading state; fetches first page on mount, debounces search queries at 300 ms, resets to first page when query is cleared, and drives infinite scroll via `IntersectionObserver` on a sentinel element using a callback ref pattern (needed because the sentinel mounts after auth resolves)
- Keyset pagination using compound cursor `(lastVisitedAt, id)` — cursor values are coerced to `Date` objects on receipt to prevent `toISOString` errors
- `DocumentSwitcherOverlay` — Ctrl+P on `EditorPage` opens a full-screen modal showing the user's library with debounced search; filters out the currently open document; closes on Escape or backdrop click
- `useDocumentSwitcher` hook — purpose-built for the overlay; same fetch/search pattern as `useLibrary` but without infinite scroll, with its own page limits, and with current-document filtering
- `useKeyboardNav` hook — manages `ArrowUp`/`ArrowDown`/`Enter` navigation over a flat list; auto-focuses the first item when the list loads, resets on list change, scrolls focused items into view via a `listRef`; used by both `LibraryPage` and `DocumentSwitcherOverlay`
- Bug fix: navigating between documents via the overlay no longer loads the new document into the stale Y.Doc — `documentId` is now passed to `useYjsSync` so the Y.Doc is re-created on document change; `useDocumentFetch` resets status to `"loading"` before fetching; `useSocket` adds `documentId` to its effect deps for explicit reconnection

### Shared package

- `LibraryDocumentDto` / `LibraryDocumentSchema` added — shape of a single document row returned by the library endpoints (`id`, `title`, `ownerName`, `lastVisitedAt`, `lastEditedAt`)
- `GetLibraryDocumentsResponseDto` / `GetLibraryDocumentsResponseSchema` added — paginated response with `documents` array and optional `nextCursor`
- `SearchLibraryDocumentsResponseDto` / `SearchLibraryDocumentsResponseSchema` added — search response with `documents` array

---

## v0.115 — Editor & Library UI Polish ✅

> Branch: `ui-v0.115`

### Web (React frontend)

- `EditorPageHeader` extracted from `EditorPage` — sync status indicator, loading state, Manage Document button, and `AvatarHeader` all live in the header component; header and title bar now stick together at the top as a unit
- `AvatarHeader` extracted from `EditorPageHeader`; `AvatarDropdown` added with user info, Library link, and Log out action; dropdown scales down on mobile
- Library button in `AvatarDropdown` wired to `/library`; logout clears the auth cookie via `POST /auth/logout` and resets `authAtom`
- `LibraryPageHeader` added so the library page has its own independently sticky header; sticky Library heading added above the search bar
- New Document button on library wired to `POST /document` and navigates directly into the new editor
- Keyboard nav removed from library page; `LibraryDocumentCard` font sizes reduced
- Removed vertical indent line from nested BlockNote block groups; title bar left edge aligned with editor content
- Browser tab title no longer appends the app name on the editor page
- `AnimatedDots` component adopted for all loading and pending states throughout the app
- `ManageDocumentModal` added — triggered by the Manage Document button in the editor header; bottom sheet on mobile, centred dialog on sm+; swipe-down-to-dismiss on mobile
- Overview tab in `ManageDocumentModal` displays title, creator, created date, last-visited, and last-edited timestamps
- Tab navigation sidebar in the modal: active tab highlighted with `bg-background-elevated`; horizontal tab bar on mobile, vertical sidebar on sm+
- Soft-delete wired end-to-end: Delete Document button in the Overview tab opens a confirmation dialog; confirmed deletion calls `DELETE /document/:id` and navigates to `/library`
- Date formatting via `formatDate` utility — outputs "Sep 5, 1999, 1:25:59 a.m." (abbreviated month, time with seconds, lowercase dotted a.m./p.m.)
- Editor components reorganised into feature-scoped subdirectories (`header/`, `manageDocumentModal/`, `documentSwitcherOverlay/`); `AvatarDropdown` and `AvatarHeader` promoted to shared `src/components/`
- Modal and switcher logic extracted into custom hooks: `useManageDocumentModal`, `useOverviewTab`, `useDeleteDocument`; `useDocumentSwitcher` extended to own Escape handling, auto-focus, and `handleDocumentClick`

### Server (NestJS backend)

- Migration `0011_add_soft_delete_to_documents` — adds `is_deleted boolean NOT NULL DEFAULT false` and `deleted_at timestamptz` to `documents`; all read queries filter out soft-deleted rows
- `DELETE /document/:id` — soft-deletes the document, sets `is_deleted = true` and `deleted_at = now()`; requires `AuthGuard`; enforces ownership (404 / 403)
- `GET /document/:id/overview` — returns title, creator name, creator email, created_at, last_visited_at, and last_edited_at; requires `AuthGuard`
- `POST /auth/logout` — clears the `authToken` cookie; requires `AuthGuard`

### Shared package

- `GetDocumentOverviewResponseDto` / `GetDocumentOverviewResponseSchema` added for `GET /document/:id/overview`

---

## v0.12 — Document Access Control ✅

> Branch: `document-access-v0.12`

### Server (NestJS backend)

- `owner_id` column added to `documents` (migration `0008_add_owner_id_to_documents`) — ownership checks migrated from `creator_id` to `owner_id`; `creator_id` is retained for audit but no longer drives access
- `document_access` table created (migration `0009_create_document_access`) — stores explicit per-user access levels (`admin`, `editor`, `viewer`, `noAccess`) for a document; composite PK on `(document_id, user_id)`, FK cascade on both columns
- `default_access` column added to `documents` (migration `0010_add_default_access_to_documents`) — fallback access level applied to users with no explicit row; defaults to `noAccess`
- `DocumentService` split into three focused services: `DocumentService` (document CRUD), `DocumentAccessService` (all access resolution and management), `DocumentYjsService` (Yjs in-memory state, updates, compaction)
- `DocumentController` split; all access endpoints moved to `DocumentAccessController` under the `/document-access` prefix
- `resolveAccess(documentId, userId)` on `DocumentAccessService` — three-tier resolution: owner row > explicit `document_access` row > `default_access` fallback
- `ACCESS_RANK` constant and `hasAccess(resolved, required)` method on `DocumentAccessService` — numeric rank comparison (`noAccess: 0` → `owner: 40`) used for ordered access checks throughout
- All existing HTTP endpoints (`GET /document/:id`, `DELETE /document/:id`, `GET /document/:id/overview`, etc.) now use `resolveAccess` for role-based enforcement instead of flat ownership checks
- `GET /document-access/:documentId` — returns paginated list of users with explicit access, keyset paginated on `(created_at, user_id)`; requires viewer+
- `GET /document-access/:documentId/search` — fuzzy-searches existing access users by email; requires viewer+
- `GET /document-access/:documentId/find-new` — resolves a user by exact email who has no access yet (owner/already-has-access returns 409); requires admin+
- `PUT /document-access/:documentId/:userId` — creates or updates an explicit access row; owners may assign any level, admins may assign up to editor; requires admin+
- `DELETE /document-access/:documentId/:userId` — removes an explicit access row; owners may remove any user, admins may only remove editor and below; requires admin+
- `GET /document-access/:documentId/default` — returns the document's default access level; requires viewer+
- `PUT /document-access/:documentId/default` — updates the default access level; requires admin+
- `GET /document/:id/owner` — returns the owner's profile; requires viewer+
- `GET /document/:id/owner/find` — resolves a transfer candidate by exact email (rejects self-transfer and non-viewer targets); requires owner
- `PUT /document/:id/owner` — transfers ownership to another user; requires owner
- Library endpoint updated to return all documents the user can access (not just owned ones), ordered by `last_visited_at`; `ownerName` replaced by the user's resolved access level label
- `DocumentGateway` stamps `resolvedAccess` on `client.data.access` at connection time (one DB call, reused for all events); write handlers (`SYNC_DOC_SERVER`, `SYNC_DOC_TITLE_SERVER`) reject viewers; repair sync pipeline (`REPAIR_SYNC_ACK_DOC_SERVER`, `REPAIR_ACK_DOC_SERVER`) gates only `applyDocUpdate` + broadcast behind editor+, always completing the handshake so viewers stay current

### Web (React frontend)

- `documentAccessAtom` added to `atoms/document.ts` — stores the resolved access level seeded from the document-load response; cleared on unmount; read directly by components and hooks (never passed as prop)
- `hasAccess(resolved, required)` added to `web/src/utils/utils.ts` — web-side counterpart using `ACCESS_RANK` from `@converge/shared`
- Manage Access tab in `ManageDocumentModal` — add users by exact email (admin+), search existing users by email (all access levels), change or remove per-user access via `DocumentAccessUserCard` dropdown, infinite scroll pagination on the existing-access list
- Default Access tab — displays and edits the document's fallback access level; dropdown disabled for non-admins but value remains visible
- Owner tab — shows current owner's profile; transfer ownership flow with email search, found-user card, and confirmation modal; entire section hidden below owner level
- `DocumentAccessUserCard` dropdown — interactive only when: not self; requester is owner OR (requester is admin AND target is editor or below); admins cannot assign the admin level; "None" removal option shown only when `canDeleteAccess` and the above conditions are met
- Progressive UI gating throughout the editor based on `documentAccessAtom`: header status label and Manage Document button (viewer+); delete button in Overview tab (admin+); BlockNote `editable` prop (editor+); title input `disabled` (editor+)
- Library page updated to show all accessible documents with the user's access level label in place of owner name

### Shared package

- `ResolvedDocumentAccessLevel` type and `ResolvedDocumentAccessLevelSchema` added — union of `DocumentAccessLevel | "owner"`
- `ACCESS_RANK` exported from `@converge/shared/types` — numeric rank map for ordered access comparisons on both server and client
- DTOs and Zod schemas added for all new access endpoints: `GetDocumentAccessResponseDto`, `SearchDocumentAccessUsersResponseDto`, `FindNewDocumentAccessUserResponseDto`, `GetDocumentOwnerResponseDto`, `GetDocumentDefaultAccessResponseDto`
- `GetDocumentResponseDto` updated to include `resolvedAccess: ResolvedDocumentAccessLevel`
- `LibraryDocumentDto` updated: `ownerName` replaced by `access: ResolvedDocumentAccessLevel`

---

## v0.13 — Workspaces & Access Overrides ✅

> Branch: `workspaces-v0.13`

### Server (NestJS backend)

- `workspaces` table (migration `0016`) — name, owner_id, type (`personal`/`custom`), and per-role document access defaults (`admin_doc_access`, `member_doc_access`, `non_member_doc_access`); personal workspace created automatically on first signup
- `workspace_members` table (migration `0017`) — tracks users in a workspace with roles (`owner`, `admin`, `member`); composite PK on `(workspace_id, user_id)`; `last_visited_at` added in migration `0023` for recency sorting
- `workspace_id` added to `documents` (migration `0018`) — every document belongs to exactly one workspace; set at creation time
- `current_workspace_id` added to `users` (migration `0019`) — tracks the user's currently selected workspace; updated by the select-workspace endpoint
- `owner_id` and `default_access` dropped from `documents` (migration `0020`) — ownership is now determined via the workspace owner (role = `'owner'` in `workspace_members`); per-document fallback replaced by workspace-level per-role defaults
- Per-doc role overrides added to `documents` (migration `0021`) — nullable `admin_doc_access`, `member_doc_access`, `non_member_doc_access` columns override workspace defaults for a single document
- GIN trigram index on `workspaces.name` (migration `0022`) to power the workspace search endpoint
- `resolveAccess` rewritten to a 4-tier chain: workspace owner → explicit `document_access` row → per-doc role override → workspace-level role default
- `hasAccess` moved from `DocumentAccessService` to `@converge/shared` — imported directly by the server and re-exported from `web/src/utils/utils.ts`
- `WorkspaceModule` with `WorkspaceController` and `WorkspaceService`:
  - `GET /workspaces` — paginated list enriched with owner info, caller's role, and recency sorting by `last_visited_at`
  - `GET /workspaces/search` — trigram similarity search by workspace name
  - `POST /workspaces` — create a workspace (first member row inserted with role `owner`)
  - `GET /workspaces/:id` — overview (name, caller's role, member count)
  - `PATCH /workspaces/:id` — rename; requires admin+
  - `PUT /workspaces/:id/select` — select workspace; updates `current_workspace_id` and `last_visited_at` on the membership row
  - `POST /workspaces/:id/leave` — leave workspace; blocked for the owner and when the workspace is currently selected
  - `GET /workspaces/:id/role` — returns the caller's role in the workspace
  - `GET /workspaces/:id/members` — paginated member list with email search
  - `POST /workspaces/:id/members` — add a member by exact email; requires admin+
  - `DELETE /workspaces/:id/members/:userId` — remove a member; requires admin+
  - `GET /workspaces/:id/owner` — owner profile; requires member+
  - `GET /workspaces/:id/owner/find` — find an ownership transfer candidate by email; requires owner
  - `PUT /workspaces/:id/owner` — transfer workspace ownership; requires owner
  - `GET /workspaces/:id/document-access` — returns per-role doc access defaults; requires member+
  - `PUT /workspaces/:id/document-access` — update per-role defaults; requires admin+
- `DocumentAccessController` extended:
  - `GET /document-access/:documentId/role-overrides` — returns per-doc role overrides together with workspace defaults and workspace name; requires viewer+
  - `PUT /document-access/:documentId/role-overrides` — update per-doc role overrides; requires admin+
  - Per-user access paths changed from `/:userId` to `/user/:userId` to avoid route collisions
  - `fallbackAccess` added to all per-user access responses — the level a user would revert to if their explicit row were removed
- `GET /auth/me` and `GET /auth/google` now return the caller's selected workspace info

### Web (React frontend)

- Collapsible sidebar added to all pages via the `Page` component — workspace dropdown (switches the selected workspace and refreshes), Library and Workspaces nav buttons, recent documents list, user avatar
- `WorkspacesPage` at `/workspaces` — workspace cards with search, create workspace modal, and a Select button that calls the select endpoint and reloads the page
- `WorkspaceConfigModal` — triggered from the workspace card; tabs: General (name, rename, leave), Members (add/search/remove), Document Access (per-role defaults), Owner (transfer ownership)
- `ManageDocumentModal` Access Overrides tab replaces the three old tabs (Manage Access, Default Access, Owner) — role-override dropdowns (Admin / Member / Non-member) reset to workspace defaults via a "Default (…)" sentinel value, plus an email-driven user-override section with infinite scroll
- `DocumentUserAccessCard` — new card component; shows `fallbackAccess` as a dim subtitle; uses correct `/user/:userId` API paths; permission rules enforced locally (owner may touch anything; admins may not promote to admin or touch admin-level entries)
- `DocumentSwitcherOverlay` (Ctrl+P) available on Library and Workspaces pages as well as the editor
- Editor breadcrumb: "workspace name › document title" displayed in the editor header; document title scrolls with content rather than staying fixed
- `useUndoManagerGuard` hook extracts undo/redo guard logic from `useEditor`; `useEditorScrollGap` extracts the scroll-padding effect; several other inline effects extracted into focused hooks
- `LibraryDocumentCard` gains a Manage Document button; Library page restructured to pass `workspaceId` to API calls
- `refreshSidebarAtom` added as a reactive trigger for sidebar re-fetches after workspace state changes

### Shared package

- Workspace DTOs and Zod schemas added to `@converge/shared/http/workspace`
- `GetDocumentRoleOverridesResponseDto`, `UpdateDocumentRoleOverridesRequestDto`, `UpdateDocumentRoleOverridesResponseDto`, `SetDocumentUserAccessResponseDto` added to `@converge/shared/http/document`
- `hasAccess` and `ACCESS_RANK` moved to `@converge/shared/types` and exported from the package root
- Removed DTOs no longer needed after tab consolidation: `GetDocumentOwnerResponseDto`, `FindNewDocumentOwnerResponseDto`, `TransferDocumentOwnerResponseDto`, `GetDocumentDefaultAccessResponseDto`, `SetDocumentDefaultAccessResponseDto`
- `WorkspaceRole` and `WorkspaceType` enum types added

### Tooling

- Tmux dev environment setup script (`setup-dev.sh`) — launches server, web, and infra panes in a preconfigured session
- `AGENTS.md` added to configure OpenCode agent permissions
- `review-and-commit` and `add-comments` skills updated to include untracked files in diffs

---

## Upcoming

### v0.14 — Awareness

- Live cursors and selections via Yjs awareness protocol forwarded through the server

### v0.15 — Media Support

- Image and video upload, S3-backed storage wired into the BlockNote editor

### v0.16 — Document References

- Inline `@document` mentions and backlinks

### v0.17 — Offline Support

- IndexedDB caching via `y-indexeddb`; offline-aware sync gate so stale state vectors are never sent to the server before the local snapshot is loaded
