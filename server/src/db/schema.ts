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
export interface DocumentMetaTable {
    document_id: number;        // primary key
    update_count: bigint;       // BIGINT maps to JS BigInt via Kysely
    last_compact_count: bigint; // 0 until first compaction
    title: string;              // editable document title; empty string = untitled
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

// Root schema passed as a generic to Kysely<DatabaseSchema>.
// Table names must exactly match the Postgres table names.
export interface DatabaseSchema {
    document_updates: DocumentUpdatesTable;
    document_meta: DocumentMetaTable;
    users: UsersTable;
}
