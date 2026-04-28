import { Kysely } from 'kysely';

/**
 * Adds soft-delete support to the documents table. `is_deleted` is the
 * primary flag used in all read queries; `deleted_at` records when the
 * document was soft-deleted for audit purposes and future trash-expiry logic.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('is_deleted', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  await db.schema
    .alterTable('documents')
    .addColumn('deleted_at', 'timestamptz', (col) => col.defaultTo(null))
    .execute();
}

/**
 * Drops the soft-delete columns, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('documents').dropColumn('is_deleted').execute();

  await db.schema.alterTable('documents').dropColumn('deleted_at').execute();
}
