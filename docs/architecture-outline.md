# Architecture Doc — Section Outline

## Low-Level Doc

### Backend
1. **Monorepo & Project Structure** — pnpm workspace layout, env config (`.env.<NODE_ENV>`), server bootstrap, process handlers
2. **Tech Stack** — all libs with a one-liner on why each was chosen
3. **Database Schema & Migrations** — all 6 tables, indexes, Redis keys (schema.md already written — section just references and summarises it)
4. **Authentication** — Google OAuth end-to-end: code exchange → JWT → httpOnly cookie → `GET /auth/me` → `authAtom`; `AuthGuard`
5. **Workspace System** — personal vs custom, membership roles (owner/admin/member), per-role doc access defaults, select-workspace flow
6. **Document CRUD & Lifecycle** — create, soft-delete, library, search, metadata (`document_user_metadata`)
7. **Document Access Control** — 4-tier resolution chain, `hasAccess`, `ACCESS_RANK`, per-doc role overrides *(interview critical)*
8. **Yjs Real-time Sync** — Y.Doc lifecycle (lazy load, per-doc map, eviction), update persistence, repair sync protocol, compaction (threshold + Redis lock), multi-server via Redis pub/sub *(interview critical)*
9. **Presence & Awareness** — `DocumentAwarenessService`, Redis hash + socket Set for multi-tab ref counting, `AwarenessUser` shape, pub/sub broadcast
10. **Redis** — all three uses: pub/sub channels, distributed locks, awareness keys + Socket Sets, throttler storage
11. **API Conventions** — `httpOK`/`httpFail`, `WsResponse`, `ZodHttpValidationPipe`, `ZodSocketValidationPipe`, rate limiting (`UserThrottlerGuard`)

### Frontend
12. **Frontend State — Jotai Atoms** — `authAtom`, `isSocketReadyAtom`, `documentAccessAtom`, `sidebar`, `refreshSidebarAtom`
13. **Frontend Routing & Pages** — `Page` component + `authRequired`, all routes, page breakdown
14. **Frontend Hooks Inventory** — one-liner per hook, grouped by domain
15. **Socket Client** — `socket.ts`, `useSocket`, emit/receive utils, readiness gating on `isSocketReadyAtom`
16. **Editor (BlockNote)** — editor creation, extensions (`deleteBlockExtension`, `codeBlockExtension`, schema), `useEditor` composition, theme

### Shared
17. **`@converge/shared`** — what lives there, HTTP types/schemas, socket events/types, `hasAccess`/`ACCESS_RANK`

### Infrastructure
18. **Deployment** — nginx (`ip_hash` sticky sessions, TLS, WebSocket upgrades), blue-green Docker strategy, `deploy.py`
