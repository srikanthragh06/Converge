import { Kysely } from 'kysely';

/**
 * Creates a B-tree index on `workspaces.owner_id` so
 * `upsertUserPersonalWorkspace` — called on every login and signup to look
 * up a user's personal workspace — can find it without a sequential scan
 * over the entire table.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('idx_workspaces_owner_id')
    .on('workspaces')
    .column('owner_id')
    .execute();
}

/**
 * Drops the owner_id index, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_workspaces_owner_id').execute();
}
