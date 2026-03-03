// Initial schema migration.
// up: creates document_meta (FK target) then document_updates + index.
// down: drops tables in reverse dependency order.

import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Created first — document_updates.document_id references this table's PK.
    await db.schema
        .createTable("document_meta")
        .ifNotExists()
        .addColumn("document_id", "integer", (c) => c.primaryKey())
        .addColumn("update_count", "bigint", (c) => c.notNull().defaultTo(0))
        .addColumn("last_compact_count", "bigint", (c) =>
            c.notNull().defaultTo(0),
        )
        .execute();

    // Append-only Yjs update log — primary persistence store.
    await db.schema
        .createTable("document_updates")
        .ifNotExists()
        .addColumn("id", "bigserial", (c) => c.primaryKey())
        .addColumn("document_id", "integer", (c) =>
            c.notNull().references("document_meta.document_id"),
        )
        .addColumn("update", "bytea", (c) => c.notNull())
        .addColumn("created_at", "timestamptz", (c) =>
            c.notNull().defaultTo(sql`now()`),
        )
        .execute();

    // Index on document_id so range queries (load, compact) don't do full-table scans.
    await db.schema
        .createIndex("document_updates_document_id_idx")
        .ifNotExists()
        .on("document_updates")
        .column("document_id")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop in reverse dependency order — document_updates holds the FK.
    await db.schema.dropTable("document_updates").ifExists().execute();
    await db.schema.dropTable("document_meta").ifExists().execute();
}
