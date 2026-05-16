import { Kysely, sql } from 'kysely';

/**
 * Creates a B-tree index on workspace_members.user_id to cover queries that
 * filter by user_id alone. The composite PK (workspace_id, user_id) does not
 * cover this direction, causing a sequential scan on hot paths like
 * getWorkspaces and searchWorkspaces which run on every page load.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX idx_workspace_members_user_id
    ON workspace_members (user_id)
  `.execute(db);
}

/**
 * Drops the user_id index from workspace_members.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS idx_workspace_members_user_id`.execute(db);
}
