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

---

### `documents`
One row per document. Tracks compaction counters — does not store content.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `bigserial` | PK | |
| `update_count` | `integer` | NOT NULL, default `0` | Incremented atomically on every persisted Yjs update |
| `last_compact_count` | `integer` | NOT NULL, default `0` | Value of `update_count` at the last compaction; used to detect when the threshold is crossed again |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

---

### `document_updates`
Append-only log of raw Yjs binary update payloads. The full document state is reconstructed by merging all rows for a document via `Y.mergeUpdates()`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `bigserial` | PK | Monotonically increasing — used as a snapshot cursor during compaction |
| `update` | `bytea` | NOT NULL | Raw Yjs update binary; deserialised to `Buffer` by the `pg` driver |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

> **Compaction:** When `update_count >= last_compact_count + 5000`, all rows up to `MAX(id)` are merged into a single row and the originals are deleted in one transaction. Only one server runs compaction at a time, gated by a Redis lock.

---

## Redis

### Pub/Sub Channels

| Channel | Constant | Publisher | Subscribers | Payload |
|---|---|---|---|---|
| `document-update` | `REDIS_EVENTS.documentUpdate` | Any server that applies a Yjs update | All other server instances | `{ clientId, update: string (base64) }` |

> Each message includes the publishing server's `clientId` (UUID). Subscribers skip messages where `clientId` matches their own to prevent echo loops.

---

### Distributed Locks

| Key | Constant | TTL | Purpose |
|---|---|---|---|
| `lock:compaction` | `REDIS_LOCKS.compaction` | 1 hour | Ensures only one server instance runs document update compaction at a time. Acquired with `SET NX PX`; released explicitly after compaction completes. TTL is a safety net in case the holder crashes before releasing. |
