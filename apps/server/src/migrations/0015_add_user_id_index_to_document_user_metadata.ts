import { Kysely } from 'kysely';

/**
 * Creates a B-tree index on `document_user_metadata.user_id` so the library
 * queries (`getLibraryDocuments`, `searchLibraryDocuments`) can find a user's
 * metadata rows without a sequential scan. The composite PK `(document_id,
 * user_id)` does not cover this direction because `user_id` is not the leading
 * column.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('idx_document_user_metadata_user_id')
    .on('document_user_metadata')
    .column('user_id')
    .execute();
}

/**
 * Drops the user_id index, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('idx_document_user_metadata_user_id')
    .execute();
}
