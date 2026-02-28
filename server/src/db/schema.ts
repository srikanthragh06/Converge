// Kysely schema type interfaces for the Postgres tables.
// Imported by Database.ts and Persistence.ts.

import { Generated } from "kysely";

// Row shape for the document_updates table.
// BYTEA columns deserialise to Buffer via the pg driver.
// Generated<T> marks columns that Postgres populates automatically.
export interface DocumentUpdatesTable {
    id: Generated<bigint>;
    document_id: number;
    update: Buffer;
    snapshot_version: number | null; // null for all v0.04 inserts; populated in v0.06
    created_at: Generated<Date>;
}

// Row shape for the snapshots table.
// Table exists now so the schema is correct from day one; populated in v0.06.
export interface SnapshotsTable {
    id: Generated<number>;
    document_id: number;
    s3_key: string;
    created_at: Generated<Date>;
}

// Root schema passed as a generic to Kysely<DatabaseSchema>.
// Table names must exactly match the Postgres table names.
export interface DatabaseSchema {
    document_updates: DocumentUpdatesTable;
    snapshots: SnapshotsTable;
}
