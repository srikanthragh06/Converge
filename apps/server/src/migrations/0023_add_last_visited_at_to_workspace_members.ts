import { Kysely, sql } from 'kysely';

/**
 * Adds a last_visited_at column to workspace_members so the client can
 * sort workspaces by recency. Set on every PUT /workspaces/:id/select.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE workspace_members
    ADD COLUMN last_visited_at TIMESTAMP WITH TIME ZONE
  `.execute(db);
}

/**
 * Drops the last_visited_at column from workspace_members.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE workspace_members
    DROP COLUMN last_visited_at
  `.execute(db);
}
