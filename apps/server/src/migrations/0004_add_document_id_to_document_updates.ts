import { Kysely } from 'kysely';

/**
 * Adds `document_id` to `document_updates` as a NOT NULL foreign key
 * referencing `documents.id`, and creates an index on it. This scopes every
 * Yjs update row to a specific document, which is required for multi-document
 * support — without it all persistence and compaction queries are full table
 * scans over a single implicit document.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('document_updates')
    .addColumn('document_id', 'bigint', (col) =>
      col.notNull().references('documents.id').onDelete('cascade'),
    )
    .execute();

  await db.schema
    .createIndex('idx_document_updates_document_id')
    .on('document_updates')
    .column('document_id')
    .execute();
}

/**
 * Drops the index and `document_id` column from `document_updates`, reversing
 * the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('idx_document_updates_document_id')
    .execute();

  await db.schema
    .alterTable('document_updates')
    .dropColumn('document_id')
    .execute();
}
