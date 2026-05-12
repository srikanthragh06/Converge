import { Kysely, sql } from 'kysely';

/**
 * Drops `owner_id` and `default_access` from `documents`. Document ownership
 * is now determined via workspace_members (role = 'owner'), and per-document
 * default access is replaced by the per-role defaults on the workspaces table.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_documents_owner_id').execute();
  await db.schema.alterTable('documents').dropColumn('owner_id').execute();
  await db.schema.alterTable('documents').dropColumn('default_access').execute();
}

/**
 * Restores the dropped columns. The columns will be NULL until backfilled.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('owner_id', 'bigint', (col) => col.references('users.id'))
    .execute();

  await db.schema
    .alterTable('documents')
    .addColumn('default_access', 'text', (col) =>
      col
        .notNull()
        .defaultTo('noAccess')
        .check(sql`default_access IN ('admin', 'editor', 'viewer', 'noAccess')`),
    )
    .execute();

  await db.schema
    .createIndex('idx_documents_owner_id')
    .on('documents')
    .column('owner_id')
    .execute();
}
