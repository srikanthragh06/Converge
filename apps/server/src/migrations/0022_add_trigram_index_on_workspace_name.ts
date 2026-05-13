import { Kysely, sql } from 'kysely';

/**
 * Creates a GIN trigram index on `workspaces.name` to accelerate
 * ILIKE substring searches in the workspaces page.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX workspaces_name_trgm_idx
    ON workspaces
    USING GIN (name gin_trgm_ops)
  `.execute(db);
}

/**
 * Drops the trigram index on `workspaces.name`, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS workspaces_name_trgm_idx`.execute(db);
}
