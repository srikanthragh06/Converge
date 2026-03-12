// Kysely schema type interfaces for the Postgres tables.
// Imported by Database.ts, Persistence.ts, and Compactor.ts.

import { Generated } from "kysely";

// Row shape for the document_updates table.
// BYTEA columns deserialise to Buffer via the pg driver.
// Generated<T> marks columns that Postgres populates automatically.
export interface DocumentUpdatesTable {
    id: Generated<bigint>;
    document_id: number;
    update: Buffer;
    created_at: Generated<Date>;
}

// One row per document — tracks monotonic update count, last compaction threshold, and title.
// update_count increments on every saveUpdate; never reset.
// last_compact_count records the 1000-multiple at which the last compaction ran.
// title is NOT NULL (defaults to '' in Postgres); set via PATCH /documents/:id/title.
// created_by_id is the users.id of the first person to create the document; nullable for pre-v0.12 docs.
// document_id is Generated because migration 4 added a sequence default for auto-increment on INSERT.
export interface DocumentMetaTable {
    document_id: Generated<number>; // primary key — auto-generated via sequence since v0.12
    update_count: bigint;           // BIGINT maps to JS BigInt via Kysely
    last_compact_count: bigint;     // 0 until first compaction
    title: string;                  // editable document title; empty string = untitled
    created_by_id: number | null;   // FK → users.id; null for docs created before v0.12
}

// Row shape for the users table.
// display_name and avatar_url come from Google OAuth user metadata and may be null.
export interface UsersTable {
    id: Generated<number>;   // serial — auto-increment integer PK
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
}

// Per-user per-document record: view/edit timestamps and the user's access role on the doc.
// Composite PK (document_id, user_id) — one row per (doc, user) pair.
// access_level is constrained by a CHECK in migration 5 to 'owner'|'admin'|'editor'|'viewer'.
export interface DocumentUserMetaTable {
    document_id: number;
    user_id: number;
    last_viewed_at: Generated<Date>;
    last_edited_at: Date | null;
    access_level: string; // 'owner' | 'admin' | 'editor' | 'viewer' — enforced by DB CHECK
}

// Root schema passed as a generic to Kysely<DatabaseSchema>.
// Table names must exactly match the Postgres table names.
export interface DatabaseSchema {
    document_updates: DocumentUpdatesTable;
    document_meta: DocumentMetaTable;
    users: UsersTable;
    document_user_meta: DocumentUserMetaTable;
}
