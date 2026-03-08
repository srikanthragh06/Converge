// Migration 3: add title column to document_meta.
// title is NOT NULL with a default of '' so existing rows get an empty string automatically.
// up: adds the column; down: drops it.

import { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // NOT NULL + DEFAULT '' ensures existing rows are backfilled without any manual update.
    await db.schema
        .alterTable("document_meta")
        .addColumn("title", "text", (c) => c.notNull().defaultTo(""))
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.alterTable("document_meta").dropColumn("title").execute();
}
