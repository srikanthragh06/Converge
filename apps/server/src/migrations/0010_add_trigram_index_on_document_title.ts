import { Kysely, sql } from 'kysely';

/**
 * Creates a GIN trigram index on `documents.title` to accelerate
 * ILIKE substring searches and similarity queries in the library UI.
 * GIN is preferred over GiST here because library searches are read-heavy.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX documents_title_trgm_idx
    ON documents
    USING GIN (title gin_trgm_ops)
  `.execute(db);
}

/**
 * Drops the trigram index on `documents.title`, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS documents_title_trgm_idx`.execute(db);
}
