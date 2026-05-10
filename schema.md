# Converge — Data Schema

## PostgreSQL

### `users`
Stores accounts authenticated via Google OAuth.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `bigserial` | PK | Auto-incrementing internal ID |
| `google_id` | `varchar` | NOT NULL, UNIQUE | Stable `sub` claim from Google ID token — used as the lookup key on every login |
| `email` | `varchar` | NOT NULL, UNIQUE | May change on Google's side; not used as a lookup key |
| `name` | `varchar` | NOT NULL | Display name from Google profile |
| `avatar_url` | `varchar` | nullable | Profile picture URL from Google |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### Indexes

| Index | Columns | Type | Source | Purpose |
|---|---|---|---|---|
| `users_pkey` | `id` | B-tree | Implicit — PK | Fast row lookup by primary key; used by all joins and FK checks from other tables referencing `users.id`. |
| `users_google_id_key` | `google_id` | B-tree unique | Implicit — UNIQUE | Enforces one account per Google identity. Used as the lookup key on every login (`WHERE google_id = ?`) to find existing users and sync profile changes. |
| `users_email_key` | `email` | B-tree unique | Implicit — UNIQUE | Enforces one account per email address. Used by exact-email search endpoints (`findNewDocumentAccessUser`, `findNewDocumentOwner`) and prevents duplicate accounts for the same email. |

---

### `documents`
One row per document. Stores the title and tracks compaction counters — does not store content.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `creator_id` | `bigint` | NOT NULL, FK → `users.id`, indexed | The user who originally created the document; retained for audit but no longer used for ownership or access checks |
| `owner_id` | `bigint` | NOT NULL, FK → `users.id`, indexed | The current document owner; used for all ownership and access checks. Starts as `creator_id` and can be transferred |
| `title` | `text` | NOT NULL, default `''` | User-editable document title; trimmed and capped at 32 characters before persisting. Has a GIN trigram index (`pg_trgm`) used by the library search endpoint |
| `default_access` | `document_access_level` | NOT NULL, default `'noAccess'` | Fallback access level for users with no explicit row in `document_access`; one of `admin`, `editor`, `viewer`, `noAccess` |
| `is_deleted` | `boolean` | NOT NULL, default `false` | Soft-delete flag; all read queries filter on `is_deleted = false` |
| `deleted_at` | `timestamptz` | nullable | Set to `now()` when soft-deleted; null until then. Kept for audit and future trash-expiry logic |
| `update_count` | `integer` | NOT NULL, default `0` | Incremented atomically on every persisted Yjs update |
| `last_compact_count` | `integer` | NOT NULL, default `0` | Value of `update_count` at the last compaction; used to detect when the threshold is crossed again |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### Indexes

| Index | Columns | Type | Source | Purpose |
|---|---|---|---|---|
| `documents_pkey` | `id` | B-tree | Implicit — PK | Fast row lookup by primary key; used by all joins and FK checks from `document_updates`, `document_user_metadata`, and `document_access`. |
| `idx_documents_creator_id` | `creator_id` | B-tree | Explicit — 0005 | Accelerates queries that filter or join on the document creator. Used by audit and ownership-transfer logic that consults `creator_id`. |
| `idx_documents_owner_id` | `owner_id` | B-tree | Explicit — 0012 | Accelerates all ownership checks — `resolveAccess` compares `owner_id` on every access resolution, and the library query joins on `owner_id` to resolve the "owner" tier. This is one of the most frequently hit indexes in the app. |
| `documents_title_trgm_idx` | `title` | GIN (trigram) | Explicit — 0010 | Powers the library search endpoint (`GET /document/library/search`). The GIN trigram index on `pg_trgm` enables `similarity()` to rank documents by title proximity without a sequential scan. GIN is preferred over GiST because library searches are read-heavy. |

---

### `document_updates`
Append-only log of raw Yjs binary update payloads. The full document state is reconstructed by merging all rows for a document via `Y.mergeUpdates()`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `bigserial` | PK | Monotonically increasing — used as a snapshot cursor during compaction |
| `document_id` | `bigint` | NOT NULL, FK → `documents.id` ON DELETE CASCADE, indexed | Scopes each update row to a specific document |
| `update` | `bytea` | NOT NULL | Raw Yjs update binary; deserialised to `Buffer` by the `pg` driver |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### Indexes

| Index | Columns | Type | Source | Purpose |
|---|---|---|---|---|
| `document_updates_pkey` | `id` | B-tree | Implicit — PK | Fast row lookup; also used as the snapshot cursor during compaction (`WHERE id <= MAX(id)`). |
| `idx_document_updates_document_id` | `document_id` | B-tree | Explicit — 0004 | Scopes every Yjs update query to a specific document. Hit on every `loadDoc` (which fetches all persisted updates for a document), every `applyDocUpdate` (which appends a row and later queries for compaction), and every repair-sync handshake that reads historical updates. Without this index, every Yjs operation would sequentially scan the `document_updates` table. |

> **Compaction:** When `update_count >= last_compact_count + 5000`, all rows up to `MAX(id)` are merged into a single row and the originals are deleted in one transaction. Only one server runs compaction at a time, gated by a Redis lock.

---

### `document_user_metadata`
Tracks per-user activity timestamps for each document. Used by the library page to display last-visited and last-edited times.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `document_id` | `bigint` | NOT NULL, FK → `documents.id` ON DELETE CASCADE | Scopes the row to a specific document |
| `user_id` | `bigint` | NOT NULL, FK → `users.id` ON DELETE CASCADE | Scopes the row to a specific user |
| `last_visited_at` | `timestamptz` | NOT NULL, default `now()` | Upserted on every WebSocket connect for this document |
| `last_edited_at` | `timestamptz` | NOT NULL, default `now()` | Updated on every Yjs content update and title change |

> Composite PK on `(document_id, user_id)`. Rows are upserted (insert or update) rather than inserted to keep one row per user per document.

#### Indexes

| Index | Columns | Type | Source | Purpose |
|---|---|---|---|---|
| `document_user_metadata_pkey` | `(document_id, user_id)` | B-tree composite | Implicit — PK | Enforces one metadata row per user per document. Covers queries that filter on `document_id` (the leading column) — including `getDocumentOverview` and `recordLastVisited`/`recordLastEdited` upserts. |
| `idx_document_user_metadata_user_id` | `user_id` | B-tree | Explicit — 0015 | Serves the library page's primary access pattern (`WHERE user_id = ?`) by eliminating the sequential scan. The composite PK `(document_id, user_id)` cannot cover this direction because `user_id` is not the leading column. |

---

### `document_access`
Explicit per-user access grants for a document. Absence of a row means the user falls back to the document's `default_access`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `document_id` | `bigint` | NOT NULL, FK → `documents.id` ON DELETE CASCADE | Scopes this access record to a specific document |
| `user_id` | `bigint` | NOT NULL, FK → `users.id` ON DELETE CASCADE | The user this access level applies to |
| `access` | `document_access_level` | NOT NULL | Explicit access level: `admin`, `editor`, `viewer`, or `noAccess` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

> Composite PK on `(document_id, user_id)`. Access is resolved in three tiers: owner row > explicit `document_access` row > `documents.default_access`.

#### Indexes

| Index | Columns | Type | Source | Purpose |
|---|---|---|---|---|
| `document_access_pkey` | `(document_id, user_id)` | B-tree composite | Implicit — PK | Enforces one access row per user per document. Covers all queries that filter on `document_id` (the leading column), including `resolveAccess` (checking for an explicit row), `getDocumentAccessUsers` (paginated access list), and `searchDocumentAccessUsers` (trigram email search on access rows). Does **not** cover `user_id`-first queries — if a future feature needs "all docs a user has explicit access to," a separate index on `(user_id)` or `(user_id, document_id)` would be needed. |

---

## Redis

### Pub/Sub Channels

| Channel | Constant | Publisher | Subscribers | Payload |
|---|---|---|---|---|
| `document-update:<documentId>` | `REDIS_EVENTS.documentUpdate(documentId)` | Any server that applies a Yjs update | All other server instances | `{ updateBase64: string }` |
| `document-title-update:<documentId>` | `REDIS_EVENTS.documentTitleUpdate(documentId)` | Any server that persists a title change | All other server instances | `{ title: string }` |

> Yjs update payloads are base64-encoded because `Uint8Array` does not survive `JSON.stringify`. Channels are per-document so servers only receive events for documents they have active subscribers for.

---

### Distributed Locks

| Key | Constant | TTL | Purpose |
|---|---|---|---|
| `lock-compaction:<documentId>` | `REDIS_LOCKS.compaction(documentId)` | 1 hour | Ensures only one server instance runs document update compaction at a time per document. Acquired with `SET NX PX`; released explicitly after compaction completes. TTL is a safety net in case the holder crashes before releasing. |
