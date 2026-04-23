import { Kysely, sql } from 'kysely';

/**
 * Enables the pg_trgm extension, which provides trigram-based similarity
 * functions and operator classes used by the document title search index.
 * IF NOT EXISTS makes this safe to run on databases where it is already enabled.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);
}

/**
 * Drops the pg_trgm extension, reversing the up migration.
 * CASCADE drops any dependent indexes (e.g. the trigram index on documents.title).
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP EXTENSION IF EXISTS pg_trgm CASCADE`.execute(db);
}
