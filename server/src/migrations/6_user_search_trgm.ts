// Migration 6: trigram index on users.display_name for fast ShareModal user search.
// pg_trgm is already enabled by migration 4 — no CREATE EXTENSION needed here.
// The GIN index lets similarity() queries avoid sequential scans as the users table grows.

import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // GIN index with gin_trgm_ops — required for similarity() to use the index on display_name.
    await sql`
        CREATE INDEX users_display_name_trgm_idx
        ON users USING gin (display_name gin_trgm_ops)
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP INDEX IF EXISTS users_display_name_trgm_idx`.execute(db);
}
