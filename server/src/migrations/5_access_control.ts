// Migration 5: per-document access control.
// - Add access_level column to document_user_meta with a CHECK constraint restricting
//   values to 'owner', 'admin', 'editor', 'viewer'. Default is 'editor'.
// - Backfill: any user whose user_id matches document_meta.created_by_id gets 'owner'.
// - All other existing rows (collaborators who viewed before v0.13) stay as 'editor'.

import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Add access_level — NOT NULL with default 'editor' and a CHECK constraint to
    // enforce the enum. Existing rows automatically receive the default value.
    await sql`
        ALTER TABLE document_user_meta
        ADD COLUMN access_level TEXT NOT NULL DEFAULT 'editor'
        CHECK (access_level IN ('owner', 'admin', 'editor', 'viewer'))
    `.execute(db);

    // Backfill: promote the document creator to 'owner' in document_user_meta.
    // Joins document_meta on created_by_id so each doc's creator gets the owner role.
    // Rows for users who viewed but didn't create the doc remain as 'editor'.
    await sql`
        UPDATE document_user_meta dum
        SET access_level = 'owner'
        FROM document_meta dm
        WHERE dum.document_id = dm.document_id
          AND dum.user_id = dm.created_by_id
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("document_user_meta")
        .dropColumn("access_level")
        .execute();
}
