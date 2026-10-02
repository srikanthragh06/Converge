import { Kysely } from 'kysely';

/**
 * Adds doc_access_version to documents and workspace_access_version to
 * workspaces: counters bumped in the same transaction as every write that
 * can change who may access a document (per-doc grants and role overrides,
 * soft-delete/restore; workspace membership, ownership and default doc
 * access). Each open socket stamps both values when its access is resolved,
 * and every outbound room emit compares them against the current ones, so a
 * mid-session access change is caught on the server's own send path rather
 * than depending on a cross-server message being delivered. Not null with a
 * default of 0, so existing rows need no backfill.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('doc_access_version', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .execute();

  await db.schema
    .alterTable('workspaces')
    .addColumn('workspace_access_version', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .execute();
}

/**
 * Drops both access version columns, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('workspaces')
    .dropColumn('workspace_access_version')
    .execute();

  await db.schema
    .alterTable('documents')
    .dropColumn('doc_access_version')
    .execute();
}
