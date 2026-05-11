import { Kysely } from 'kysely';

/**
 * Adds current_workspace_id to users so the platform remembers which
 * workspace the user last selected. Nullable — set shortly after signup
 * once the personal workspace is created.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('current_workspace_id', 'integer', (col) =>
      col.references('workspaces.id').onDelete('set null'),
    )
    .execute();
}

/**
 * Drops current_workspace_id from users.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('current_workspace_id')
    .execute();
}
