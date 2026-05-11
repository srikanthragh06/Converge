import { Kysely } from 'kysely';

/**
 * Adds workspace_id to documents as a NOT NULL column. No FK constraint
 * yet — that will be added once workspaces have been backfilled.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('workspace_id', 'integer', (col) => col.notNull())
    .execute();
}

/**
 * Drops workspace_id from documents.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('documents').dropColumn('workspace_id').execute();
}
