# Converge

A Notion-style editor with live collaborative editing, workspaces, and granular access control.

**Live:** [converge.1k5.in](https://converge.1k5.in) · sign in with any Google account.

## Features

- **Collaborative editing** with live presence avatars showing who is focused on which block
- **Version history** with automatic and manual checkpoints, a diff view against any prior version, and one-click restore
- **Rich-text editor** built on BlockNote, with image, video, and audio upload support
- **Workspaces** to organize documents into shared spaces with owner, admin, and member roles
- **Granular access control** with four tiers: workspace role defaults, per-doc overrides, explicit user grants, and workspace owner
- **Document library** with full-text search, infinite scroll, a keyboard-navigable switcher (Ctrl+P), and a Trash tab for restoring soft-deleted documents
- **Sidebar pinning** for quick access to frequently used documents, kept separate from the recently-visited list
- **AI agent access via MCP** — a Model Context Protocol server exposes documents to AI agents over API-key auth (list, create, read, edit, rename, delete), enforcing the same access control as the browser editor; every agent-driven edit takes an automatic checkpoint beforehand so it can always be undone, and keys are self-served from a dedicated API Keys page
- **Semantic search (RAG)** — hybrid semantic + lexical retrieval over document content, reranked and exposed as a grounded, cited MCP tool; indexed incrementally as documents are edited, with live indexing-status visibility in the document Overview panel
- **In-app AI agent chat** — a workspace-scoped chat assistant that runs the same MCP tool surface (read, search, write, checkpoint/restore) through a real multi-step tool-calling loop, streaming its progress live; rate-limited on both request volume and token spend, per user, per workspace, and globally, to keep provider cost bounded
- **Google OAuth** with secure httpOnly cookie sessions

## Architecture

<img width="1480" height="720" alt="Architecture Diagram" src="https://github.com/user-attachments/assets/fea86791-ea61-4dee-a942-c8b3838eccb5" />


## Technical Highlights

**Multi-server Yjs sync via Redis pub/sub**
Each server holds one in-memory Y.Doc per open document. When a client pushes an update, the server persists it to Postgres, applies it locally, and publishes the binary blob to a per-document Redis channel. Other instances receive it, apply it to their own doc, and broadcast to their local sockets. No central coordinator required.

**Repair sync protocol**
On connect and every 15-second heartbeat, the client sends its Yjs state vector. Both sides compute what the other is missing via `Y.encodeStateAsUpdate(doc, peerSV)` and exchange only the diff. Catches missed Redis events, network gaps, and post-restart divergence without re-fetching the full document.

**Version-history checkpoints reusing the Yjs update log**
Document content is an append-only Yjs update log in Postgres. A checkpoint just merges every update row since the last checkpoint into one new row and deletes the originals — the same merge Yjs already does for sync, just scoped and flagged. Two pg-boss timers (idle and interval), persisted in Postgres rather than server memory, trigger checkpoints automatically and survive restarts across multiple server instances with no extra locking. Restoring one is `editor.replaceBlocks(...)`, flowing through the normal collaboration pipeline like any other edit.

**Four-tier access resolution, resolved live on every action**
Every handler resolves access via a short-circuit chain: workspace owner, explicit user grant, per-document role override, workspace role default. Both the single-document resolver and the library endpoint's per-row resolution run as one indexed SQL `CASE` join rather than sequential round-trips, which keeps it cheap enough to call fresh on every WebSocket write instead of caching it per connection — an admin revoking or downgrading a user's access takes effect on their very next edit, not just on their next reconnect.

**Real-time presence with per-tab ref counting**
Presence state lives in a Redis hash keyed by document. A Redis Set tracks every open socket per user so presence is cleared only when the user's last tab closes, not on individual socket disconnects.

**Zero-downtime blue-green deployment**
Two Docker Compose projects (blue on ports 5001-5003, green on 5004-5006) sit behind nginx. Each deploy builds the inactive slot, waits for healthchecks, writes a new nginx slot conf, reloads nginx atomically, then tears down the old slot.

**End-to-end type safety**
A shared package (`@converge/shared`) owns all socket event schemas and HTTP DTOs as Zod schemas. `ZodHttpValidationPipe` validates request bodies server-side; `socketEmit` / `socketReceive` wrappers validate every payload at the socket boundary on the client.

**Markdown-authored document edits over MCP**
The MCP write tool applies a batch of id-addressed block edits (replace/insert/remove) as one atomic save, with new content authored as plain Markdown rather than raw editor JSON — an agent writing Markdown is far more reliable than one constructing BlockNote's nested block schema by hand, and standard Markdown syntax already covers most block types (headings, lists, tables, code blocks, checklists) with no per-type translation needed.

**Checkpoints as an AI-agent safety net**
An AI agent editing a document unsupervised is more likely to make a large, unwanted change than a human making many small ones — so every MCP-driven edit takes a synchronous checkpoint immediately beforehand, tagged with its own source so it's distinguishable from manual and scheduled ones. It's built entirely on the existing checkpoint mechanism with no new infrastructure: one extra call, one new allowed value on an existing column.

**Live-aware RAG indexing without full re-embeds**
Content is diffed at the block level between indexing runs, and an edit only re-embeds the affected neighborhood: a fixed-point closure loop pulls in every block sharing a chunk or section with something that changed, so a chunk is never left partially deleted and a section is never re-chunked from incomplete context — without ever re-processing the whole document. Retrieval unions semantic (pgvector cosine) and lexical (BM25, scored against real corpus-wide term/length statistics rather than Postgres's own `ts_rank_cd`) candidates and reranks them — a design validated on a separate proof-of-concept branch against a 1,225-question benchmark (96.7% recall@10) and a 300-question hand-authored hard eval targeting cross-document synthesis, disambiguation, and unanswerable questions.

**Cost-aware, multi-tier rate limiting**
The one unauthenticated route (Google OAuth exchange) and every call to a paid AI provider (OpenAI embeddings, Voyage rerank, and the AI agent's chat completions) are rate-limited with Redis-backed fixed-window counters, layered user/workspace/global — each tier checked cheapest-first so an already-over-limit caller short-circuits before touching the wider ones. Embedding and agent calls track request count and token volume as independent windows, since OpenAI enforces both separately. When a single large edit's reindex run would blow through its own budget, it stops early, commits what it already embedded rather than losing it, and lets the same retry/backoff machinery pick up the remainder on a later pass — the document is briefly stale, never corrupted or incomplete.

**Tool-calling agent chat without message-history reconstruction**
The in-app AI agent talks to OpenAI's Responses API rather than resending a full conversation on every call: each turn chains off the previous one via `previous_response_id`, so the provider itself carries forward prior context, reasoning included. A server-driven loop executes whichever of the app's own access-controlled document tools the model calls — the same tool surface external MCP clients use — feeding results back as the next step's input, hard-capped at 8 steps per turn and streamed to the client step by step over hand-rolled SSE. Since the provider hides a step's true prompt size behind that chaining, its token-rate-limit budget is checked against a running total and trued up with the call's real reported usage afterward, rather than estimated ahead of time.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v3, Jotai |
| Editor | BlockNote (ProseMirror + Tiptap), Yjs, y-prosemirror |
| Backend | NestJS 11, Socket.io, Kysely, PostgreSQL 16 + pgvector, MCP SDK |
| AI/ML | OpenAI (embeddings, agent chat), Voyage AI (reranking), BM25 |
| Infrastructure | Redis 7, Docker, nginx, Supabase (DB), Upstash (Redis) |
| Shared | Zod schemas and TypeScript types via `@converge/shared` |

## Docs

- [Roadmap](./ROADMAP.md)
- [Architecture](./docs/architecture-low-level.md)
