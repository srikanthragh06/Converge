// Migration 4: document library support.
// - Enable pg_trgm extension for trigram similarity search on titles.
// - Add a SERIAL-style default to document_meta.document_id via a sequence,
//   so POST /documents can auto-generate new IDs without the client specifying one.
// - Add created_by_id FK to users so the library knows who created each doc.
// - Create document_user_meta to track per-user last_viewed_at and last_edited_at.
// - Add a GIN trigram index on document_meta.title for fast similarity queries.

import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Enable the trigram extension — required for similarity() function and gin_trgm_ops index.
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);

    // Create a sequence for document_meta.document_id and wire it as the column default.
    // setval initialises it to MAX(document_id)+1 so existing rows are never re-used.
    await sql`CREATE SEQUENCE IF NOT EXISTS document_meta_document_id_seq`.execute(db);
    await sql`ALTER TABLE document_meta ALTER COLUMN document_id SET DEFAULT nextval('document_meta_document_id_seq')`.execute(db);
    await sql`
        SELECT setval(
            'document_meta_document_id_seq',
            COALESCE((SELECT MAX(document_id) FROM document_meta), 0) + 1,
            false
        )
    `.execute(db);

    // Add created_by_id — nullable so existing rows are not broken by the migration.
    // ON DELETE SET NULL: if the creator's account is deleted, the doc remains but loses the link.
    await db.schema
        .alterTable("document_meta")
        .addColumn("created_by_id", "integer", (c) =>
            c.references("users.id").onDelete("set null"),
        )
        .execute();

    // Per-user view/edit timestamps — composite PK prevents duplicate rows per (doc, user) pair.
    await db.schema
        .createTable("document_user_meta")
        .ifNotExists()
        .addColumn("document_id", "integer", (c) =>
            c.notNull().references("document_meta.document_id").onDelete("cascade"),
        )
        .addColumn("user_id", "integer", (c) =>
            c.notNull().references("users.id").onDelete("cascade"),
        )
        .addColumn("last_viewed_at", "timestamptz", (c) =>
            c.notNull().defaultTo(sql`now()`),
        )
        .addColumn("last_edited_at", "timestamptz")
        .addPrimaryKeyConstraint("document_user_meta_pkey", ["document_id", "user_id"])
        .execute();

    // GIN trigram index on title — makes similarity() queries fast even on large title sets.
    await sql`CREATE INDEX document_meta_title_trgm_idx ON document_meta USING gin (title gin_trgm_ops)`.execute(db);

    // B-tree index on last_viewed_at — speeds up the ORDER BY last_viewed_at DESC recency query.
    await sql`CREATE INDEX document_user_meta_last_viewed_at_idx ON document_user_meta (last_viewed_at DESC)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP INDEX IF EXISTS document_user_meta_last_viewed_at_idx`.execute(db);
    await sql`DROP INDEX IF EXISTS document_meta_title_trgm_idx`.execute(db);
    await db.schema.dropTable("document_user_meta").ifExists().execute();
    await db.schema
        .alterTable("document_meta")
        .dropColumn("created_by_id")
        .execute();
    await sql`ALTER TABLE document_meta ALTER COLUMN document_id DROP DEFAULT`.execute(db);
    await sql`DROP SEQUENCE IF EXISTS document_meta_document_id_seq`.execute(db);
}
