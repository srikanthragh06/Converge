# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Converge is a full-stack Notion-like application (early stage). See ROADMAP.md for version history and what has been built so far.

## Structure

This is a pnpm workspace monorepo.

- `apps/web/` — React + Vite + Tailwind CSS v3 frontend
- `apps/server/` — NestJS + Socket.io backend
- `packages/shared/` — shared types, constants, Zod schemas, and utilities (`@converge/shared`)

## Code Style

- Use Prettier for formatting. Follow Prettier rules in all code written for this project.
- NestJS file naming: kebab-case with type suffix (e.g. `document.service.ts`, `global-exception.filter.ts`).
- Layered architecture: controllers → services → repositories. Keep business logic in services.

## Conventions

- HTTP success responses use `httpOK(data?)` from `server/src/utils/http-response.util.ts` — returns the data payload directly with no envelope. Error responses use `httpFail(message)` or `httpInternalServerError()`, which return `{ success: false, message }`. WebSocket responses use `WsResponse<T>` from `server/src/utils/ws-response.util.ts`.
- Environment config: `.env.<NODE_ENV>` takes precedence, `.env` is the shared fallback.
- All color values are defined in `web/src/theme/colors.ts`. Reference them in `editorTheme.ts` and as Tailwind classes — do not hardcode hex values elsewhere.
- Tailwind's preflight is disabled (`corePlugins.preflight: false`) to avoid conflicts with Mantine/BlockNote styles. Add manual resets in `index.css` when needed.
- Global client-side state lives in Jotai atoms under `web/src/atoms/`, split by domain (e.g. `atoms/auth.ts`, `atoms/socket.ts`). Prefer atoms over prop-drilling for state shared across hooks and components.
- Auth state is a single `authAtom` with shape `{ status: "loading" | "authenticated" | "unauthenticated", user: AuthResponseDto | null }`. Hydrate it on app mount via `useAuth`, which calls `GET /auth/me`.
- Socket readiness is tracked via `isSocketReadyAtom` (`atoms/socket.ts`). It is set to `true` only when the server emits `DOC_READY` — not on raw socket connect. All hooks that emit events or register socket listeners must gate on this atom.
- Route-level auth gating is done via the `authRequired` prop on the `Page` component (`src/components/Page.tsx`). Do not duplicate redirect logic in individual pages.
- Numeric route params (e.g. `documentId`) use `ParseIntPipe` in NestJS controllers. Service methods that enforce access throw 404 if the resource does not exist and 403 if the requesting user lacks the required access level.
- All functions, methods, and class attributes must have inline documentation following the standard in the `add-comments` skill.
- Socket event names are defined as constants in `@converge/shared/socket/events` (`SOCKET_EVENTS`). Never hardcode event name strings in `apps/`.
- Socket event payload types and Zod schemas live in `@converge/shared/socket`. Add new schemas there when adding new events.
- HTTP request/response types and Zod schemas live in `@converge/shared/http`. Add new schemas there when adding new HTTP endpoints that are consumed by both apps. Use `ZodHttpValidationPipe` on `@Body()` for server-side validation.
- All code shared between `apps/web` and `apps/server` belongs in `packages/shared`, not in either app.
- Database migrations live in `apps/server/src/migrations/`, named `<number>_<purpose>.ts` (e.g. `0001_create_document_updates.ts`). Each file exports `up` and `down` functions.
- `DatabaseService` is provided by `DatabaseModule`. Feature modules that need DB access must import `DatabaseModule` explicitly.
- Kysely table types are defined in `apps/server/src/db/database.schema.ts`. Add new table interfaces there when adding migrations.
- Redis channel name constants live in `apps/server/src/redis/redis.events.ts` (`REDIS_EVENTS`); distributed lock key constants live there too (`REDIS_LOCKS`). Redis is server-only — do not put Redis constants or utilities in `packages/shared`.
- `RedisService` is provided by `RedisModule`. Feature modules that need Redis access must import `RedisModule` explicitly.
- Binary data (e.g. Yjs `Uint8Array`) must be base64-encoded before JSON serialisation. Use `uint8ArrayToBase64` / `base64ToUint8Array` from `apps/server/src/utils/utils.ts`.
- Async code outside the NestJS pipeline (Redis pub/sub callbacks, `setTimeout`/`setInterval`, `EventEmitter` listeners, fire-and-forget calls) must have its own try-catch or `.catch()`. `GlobalExceptionFilter` only covers `@SubscribeMessage` and HTTP handlers — unhandled errors elsewhere crash the process.
- Document access is resolved via `DocumentAccessService.resolveAccess(documentId, userId)` — four-tier: workspace owner → explicit `document_access` row → per-doc role override (`admin_doc_access` / `member_doc_access` / `non_member_doc_access` on `documents`) → workspace-level role default. Use `hasAccess(resolved, required)` from `@converge/shared` for ordered comparisons on both server and client (`web/src/utils/utils.ts` re-exports it). `ACCESS_RANK` is also exported from `@converge/shared`.
- Document CRUD lives in `DocumentService`; access management (resolve, grant, revoke, role overrides) lives in `DocumentAccessService`; Yjs in-memory state and sync live in `DocumentYjsService`; real-time presence tracking lives in `DocumentAwarenessService`. All four are in the `DocumentModule`.
- Workspace CRUD and membership management live in `WorkspaceService` inside `WorkspaceModule`. Workspace HTTP routes use the `/workspaces` prefix (`WorkspaceController`).
- Document access HTTP routes use the `/document-access` prefix (`DocumentAccessController`), separate from the `/document` prefix (`DocumentController`).
- BlockNote editor extensions (custom keymaps, input rules, ProseMirror plugins) live in `apps/web/src/lib/` as module-level constants created with `createExtension` from `@blocknote/core`. Pass them via the `extensions` array in `BlockNoteEditor.create()`. Do not import `prosemirror-state` or `prosemirror-view` directly — use `editor.prosemirrorState`, `editor.prosemirrorView`, and `editor._tiptapEditor.commands` instead, since ProseMirror packages are transitive dependencies not directly accessible under pnpm's strict resolution.
- Per-user rate limiting uses `UserThrottlerGuard` (extends `ThrottlerGuard`, keys on `userId`) backed by Redis via `@nest-lab/throttler-storage-redis`. The throttler module is configured in `AppModule` with named throttlers; apply `@UseGuards(UserThrottlerGuard)` on individual endpoints rather than globally.
