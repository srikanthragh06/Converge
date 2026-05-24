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
| `current_workspace_id` | `bigint` | nullable, FK → `workspaces.id` | The workspace the user currently has selected; updated by `PUT /workspaces/:id/select` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### Indexes

| Index | Columns | Type | Source | Purpose |
|---|---|---|---|---|
| `users_pkey` | `id` | B-tree | Implicit — PK | Fast row lookup by primary key; used by all joins and FK checks from other tables referencing `users.id`. |
| `users_google_id_key` | `google_id` | B-tree unique | Implicit — UNIQUE | Enforces one account per Google identity. Used as the lookup key on every login (`WHERE google_id = ?`) to find existing users and sync profile changes. |
| `users_email_key` | `email` | B-tree unique | Implicit — UNIQUE | Enforces one account per email address. Used by exact-email search endpoints (`findNewDocumentAccessUser`, `findNewWorkspaceMember`, `findNewWorkspaceOwner`) and prevents duplicate accounts for the same email. |

---

### `workspaces`
One row per workspace. Holds the workspace name, owner reference, type, and per-role document access defaults used as the last tier in access resolution.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `serial` | PK | Auto-incrementing internal ID |
| `name` | `text` | NOT NULL | Display name of the workspace |
| `owner_id` | `integer` | NOT NULL, FK → `users.id` | The workspace owner; also present as a `workspace_members` row with role `'owner'` |
| `type` | `text` | NOT NULL, CHECK (`personal` \| `custom`) | `personal` workspaces are created automatically on first signup; `custom` workspaces are user-created |
| `admin_doc_access` | `document_access_level` | NOT NULL, default `'admin'` | Default doc access for workspace admins when no per-doc override is set |
| `member_doc_access` | `document_access_level` | NOT NULL, default `'editor'` | Default doc access for workspace members when no per-doc override is set |
| `non_member_doc_access` | `document_access_level` | NOT NULL, default `'noAccess'` | Default doc access for users not in this workspace when no per-doc override is set |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### Indexes

| Index | Columns | Type | Source | Purpose |
|---|---|---|---|---|
| `workspaces_pkey` | `id` | B-tree | Implicit — PK | Fast row lookup by primary key; used by all FK checks from `documents`, `workspace_members`, and `users.current_workspace_id`. |
| `workspaces_name_trgm_idx` | `name` | GIN (trigram) | Explicit — 0022 | Powers the workspace search endpoint (`GET /workspaces/search`). Enables `ILIKE` substring matching without a sequential scan. |

---

### `workspace_members`
Tracks which users belong to which workspace and with what role. The workspace owner is also stored here (role `'owner'`) alongside `workspaces.owner_id`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `workspace_id` | `integer` | NOT NULL, FK → `workspaces.id` ON DELETE CASCADE | Scopes this membership row to a specific workspace |
| `user_id` | `integer` | NOT NULL, FK → `users.id` ON DELETE CASCADE | The user who holds this membership |
| `role` | `text` | NOT NULL, CHECK (`owner` \| `admin` \| `member`) | Role the user holds within the workspace |
| `last_visited_at` | `timestamptz` | nullable | Set on every `PUT /workspaces/:id/select`; used to sort workspaces by recency |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

> Composite PK on `(workspace_id, user_id)`.

#### Indexes

| Index | Columns | Type | Source | Purpose |
|---|---|---|---|---|
| `workspace_members_pkey` | `(workspace_id, user_id)` | B-tree composite | Implicit — PK | Enforces one membership row per user per workspace. Covers all queries that filter on `workspace_id` (the leading column), including role lookups in `resolveAccess`, member listing, and add/remove operations. |
| `idx_workspace_members_user_id` | `user_id` | B-tree | Explicit — 0024 | Covers `getWorkspaces` and `searchWorkspaces`, which filter `WHERE user_id = ?` to list all workspaces a user belongs to. The composite PK cannot cover this direction because `user_id` is not the leading column — without this index both queries do a sequential scan on every page load. |

---

### `documents`
One row per document. Stores the title and per-doc role overrides; tracks compaction counters. Does not store content.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `creator_id` | `bigint` | NOT NULL, FK → `users.id`, indexed | The user who originally created the document; retained for audit |
| `workspace_id` | `bigint` | NOT NULL, FK → `workspaces.id`, indexed | The workspace this document belongs to; set at creation time and cannot be changed |
| `title` | `text` | NOT NULL, default `''` | User-editable document title; trimmed and capped at 32 characters before persisting |
| `admin_doc_access` | `document_access_level` | nullable | Per-doc override for workspace admins; NULL means inherit workspace default |
| `member_doc_access` | `document_access_level` | nullable | Per-doc override for workspace members; NULL means inherit workspace default |
| `non_member_doc_access` | `document_access_level` | nullable | Per-doc override for non-members; NULL means inherit workspace default |
| `is_deleted` | `boolean` | NOT NULL, default `false` | Soft-delete flag; all read queries filter on `is_deleted = false` |
| `deleted_at` | `timestamptz` | nullable | Set to `now()` when soft-deleted; null until then |
| `update_count` | `integer` | NOT NULL, default `0` | Incremented atomically on every persisted Yjs update |
| `last_compact_count` | `integer` | NOT NULL, default `0` | Value of `update_count` at the last compaction |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

#### Indexes

| Index | Columns | Type | Source | Purpose |
|---|---|---|---|---|
| `documents_pkey` | `id` | B-tree | Implicit — PK | Fast row lookup by primary key; used by all joins and FK checks from `document_updates`, `document_user_metadata`, and `document_access`. |
| `idx_documents_creator_id` | `creator_id` | B-tree | Explicit — 0005 | Accelerates queries that filter or join on the document creator. |
| `idx_documents_workspace_id` | `workspace_id` | B-tree | Explicit — 0018 | Accelerates workspace-scoped document queries — used by the library endpoint and `resolveAccess` when fetching the workspace's per-role defaults. |
| `documents_title_trgm_idx` | `title` | GIN (trigram) | Explicit — 0010 | Powers the library search endpoint (`GET /document/library/search`). Enables `similarity()` ranking without a sequential scan. GIN is preferred over GiST for read-heavy search. |

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
| `idx_document_updates_document_id` | `document_id` | B-tree | Explicit — 0004 | Scopes every Yjs update query to a specific document. Hit on every `loadDoc`, every `applyDocUpdate`, and every repair-sync handshake that reads historical updates. |

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
Explicit per-user access grants for a document. This is tier 2 in the 4-tier access resolution chain (workspace owner → **document_access row** → per-doc role override → workspace-level default).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `document_id` | `bigint` | NOT NULL, FK → `documents.id` ON DELETE CASCADE | Scopes this access record to a specific document |
| `user_id` | `bigint` | NOT NULL, FK → `users.id` ON DELETE CASCADE | The user this access level applies to |
| `access` | `document_access_level` | NOT NULL | Explicit access level: `admin`, `editor`, `viewer`, or `noAccess` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

> Composite PK on `(document_id, user_id)`.

#### Indexes

| Index | Columns | Type | Source | Purpose |
|---|---|---|---|---|
| `document_access_pkey` | `(document_id, user_id)` | B-tree composite | Implicit — PK | Enforces one access row per user per document. Covers all queries that filter on `document_id` (the leading column), including `resolveAccess` (checking for an explicit row), `getDocumentAccessUsers` (paginated access list), and `searchDocumentAccessUsers` (trigram email search on access rows). |

---

## Redis

### Pub/Sub Channels

| Channel | Constant | Publisher | Subscribers | Payload |
|---|---|---|---|---|
| `document-update:<documentId>` | `REDIS_EVENTS.documentUpdate(documentId)` | Any server that applies a Yjs update | All other server instances | `{ updateBase64: string }` |
| `document-title-update:<documentId>` | `REDIS_EVENTS.documentTitleUpdate(documentId)` | Any server that persists a title change | All other server instances | `{ title: string }` |
| `awareness-updates:<documentId>` | `REDIS_EVENTS.awarenessUpdate(documentId)` | Any server whose awareness state changes | All other server instances | `{ users: AwarenessUser[] }` — full user list, so receivers can forward without an extra Redis read |

> Yjs update payloads are base64-encoded because `Uint8Array` does not survive `JSON.stringify`. Channels are per-document so servers only receive events for documents they have active subscribers for.

---

### Distributed Locks

| Key | Constant | TTL | Purpose |
|---|---|---|---|
| `lock-compaction:<documentId>` | `REDIS_LOCKS.compaction(documentId)` | 1 hour | Ensures only one server instance runs document update compaction at a time per document. Acquired with `SET NX PX`; released explicitly after compaction completes. TTL is a safety net in case the holder crashes before releasing. |

---

### Awareness Keys

| Key pattern | Constant | Type | TTL | Purpose |
|---|---|---|---|---|
| `awareness:<documentId>` | `REDIS_KEYS.awareness(documentId)` | Hash | 1 hour | Maps `userId` (string) → JSON-serialised `AwarenessUser` for every user currently present in a document. Written on connect, updated on cursor move, deleted on last-tab disconnect. TTL is refreshed on every write as a safety net against stale entries. |
| `awareness-sockets:<documentId>:<userId>` | `REDIS_KEYS.awarenessSockets(documentId, userId)` | Set | 1 hour | Tracks the set of active `socketId`s for a user in a document — one entry per open browser tab. Used for multi-tab ref counting: the user's awareness entry is only removed when this Set becomes empty. TTL is refreshed on every write. |
