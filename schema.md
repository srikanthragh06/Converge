# Database Schema

> Last updated: **v0.125**
> Source of truth: `server/src/migrations/` (Kysely migration files)
> TypeScript interfaces: `server/src/db/schema.ts`

This file is updated after each version that adds or modifies database tables.

---

## Extensions

| Extension | Purpose | Added |
|---|---|---|
| `pg_trgm` | Trigram similarity search on document titles | v0.12 |

---

## Tables

### `document_meta`

One row per document. Tracks Yjs compaction state, editable title, and creator.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `document_id` | `INTEGER` | PK, `DEFAULT nextval(...)` | Auto-generated via sequence since v0.12; previously client-supplied |
| `update_count` | `BIGINT` | NOT NULL DEFAULT 0 | Monotonic counter — increments on every saved Yjs update, never reset |
| `last_compact_count` | `BIGINT` | NOT NULL DEFAULT 0 | Last 500-multiple threshold at which compaction ran |
| `title` | `TEXT` | NOT NULL DEFAULT '' | Editable document title; empty string = untitled; added v0.11 |
| `created_by_id` | `INTEGER` | FK → `users.id` ON DELETE SET NULL, nullable | Creator's user ID; null for docs created before v0.12 |

**Indexes**
- `document_meta_title_trgm_idx` — GIN trigram on `title` (fast `similarity()` queries)

---

### `document_updates`

Append-only log of raw Yjs binary updates. Primary persistence store.
Compaction merges rows in-place via `Y.mergeUpdates()` every 500 updates.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `BIGSERIAL` | PK | Ordered replay key — Yjs identity is `(clientID, lamport_clock)` |
| `document_id` | `INTEGER` | NOT NULL, FK → `document_meta.document_id` | |
| `update` | `BYTEA` | NOT NULL | Raw Yjs binary update; deserialises to `Buffer` via the pg driver |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` | |

**Indexes**
- `document_updates_document_id_idx` — B-tree on `document_id` (load and compact range queries)

---

### `users`

One row per authenticated user. Populated on first Google OAuth login via Supabase; upserted on every subsequent login.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `SERIAL` | PK | Auto-increment integer — internal user identifier |
| `email` | `TEXT` | NOT NULL UNIQUE | Natural key from Google OAuth; looked up on every login |
| `display_name` | `TEXT` | nullable | From Google user metadata; may be null |
| `avatar_url` | `TEXT` | nullable | From Google user metadata; may be null |
| `created_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` | Updated on every upsert (login) |

**Indexes**
- `users_email_idx` — B-tree on `email` (fast lookup on every login)

---

### `document_user_meta`

Per-user per-document timestamps. One row per `(document, user)` pair.
Used by the document library to sort by recency and track edit activity.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `document_id` | `INTEGER` | NOT NULL, FK → `document_meta.document_id` ON DELETE CASCADE | |
| `user_id` | `INTEGER` | NOT NULL, FK → `users.id` ON DELETE CASCADE | |
| `last_viewed_at` | `TIMESTAMPTZ` | NOT NULL DEFAULT `now()` | Updated whenever the user opens the document |
| `last_edited_at` | `TIMESTAMPTZ` | nullable | null until the user makes their first edit |

**Primary key**: `(document_id, user_id)` — composite, prevents duplicate rows per pair.

**Indexes**
- `document_user_meta_last_viewed_at_idx` — B-tree on `last_viewed_at DESC` (recency sort for library)

---

## Entity Relationships

```
users
  ├── document_meta.created_by_id  (nullable FK, ON DELETE SET NULL)
  └── document_user_meta.user_id   (FK, ON DELETE CASCADE)

document_meta
  ├── document_updates.document_id (FK, ON DELETE — no action, controlled by compaction)
  └── document_user_meta.document_id (FK, ON DELETE CASCADE)
```
