# Converge

A Notion-style editor with live collaborative editing, workspaces, and granular access control.

**Live:** [converge.1k5.in](https://converge.1k5.in) · sign in with any Google account.

https://github.com/user-attachments/assets/e74a9a3b-8cf7-4625-925d-6fce35e5bfdd

## Features

- **Collaborative editing** with live presence avatars showing who is focused on which block
- **Rich-text editor** built on BlockNote, with image, video, and audio upload support
- **Workspaces** to organize documents into shared spaces with owner, admin, and member roles
- **Granular access control** with four tiers: workspace role defaults, per-doc overrides, explicit user grants, and workspace owner
- **Document library** with full-text search, infinite scroll, and a keyboard-navigable switcher (Ctrl+P)
- **Google OAuth** with secure httpOnly cookie sessions

## Architecture

<img width="1480" height="720" alt="Architecture Diagram" src="https://github.com/user-attachments/assets/fea86791-ea61-4dee-a942-c8b3838eccb5" />


## Technical Highlights

**Multi-server Yjs sync via Redis pub/sub**
Each server holds one in-memory Y.Doc per open document. When a client pushes an update, the server persists it to Postgres, applies it locally, and publishes the binary blob to a per-document Redis channel. Other instances receive it, apply it to their own doc, and broadcast to their local sockets. No central coordinator required.

**Repair sync protocol**
On connect and every 15-second heartbeat, the client sends its Yjs state vector. Both sides compute what the other is missing via `Y.encodeStateAsUpdate(doc, peerSV)` and exchange only the diff. Catches missed Redis events, network gaps, and post-restart divergence without re-fetching the full document.

**Update compaction with distributed locking**
Document content is an append-only Yjs update log in Postgres. When the row count crosses 5,000, a background job merges all rows up to a snapshot cursor into a single blob and replaces them atomically. A Redis `SET NX` distributed lock ensures only one server instance compacts at a time.

**Four-tier access resolution**
Every handler resolves access via a short-circuit chain: workspace owner, explicit user grant, per-document role override, workspace role default. The library endpoint evaluates the full chain for every document in a single SQL `CASE` subquery, avoiding N+1 round-trips.

**Real-time presence with per-tab ref counting**
Presence state lives in a Redis hash keyed by document. A Redis Set tracks every open socket per user so presence is cleared only when the user's last tab closes, not on individual socket disconnects.

**Zero-downtime blue-green deployment**
Two Docker Compose projects (blue on ports 5001-5003, green on 5004-5006) sit behind nginx. Each deploy builds the inactive slot, waits for healthchecks, writes a new nginx slot conf, reloads nginx atomically, then tears down the old slot.

**End-to-end type safety**
A shared package (`@converge/shared`) owns all socket event schemas and HTTP DTOs as Zod schemas. `ZodHttpValidationPipe` validates request bodies server-side; `socketEmit` / `socketReceive` wrappers validate every payload at the socket boundary on the client.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v3, Jotai |
| Editor | BlockNote (ProseMirror + Tiptap), Yjs, y-prosemirror |
| Backend | NestJS 11, Socket.io, Kysely, PostgreSQL 16 |
| Infrastructure | Redis 7, Docker, nginx, Supabase (DB), Upstash (Redis) |
| Shared | Zod schemas and TypeScript types via `@converge/shared` |

## Docs

- [Roadmap](./ROADMAP.md)
- [Architecture](./docs/architecture-low-level.md)
