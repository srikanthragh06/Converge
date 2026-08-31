import { Kysely } from 'kysely';

/**
 * Creates a B-tree index on `documents.workspace_id` so workspace-scoped
 * document queries (`getLibraryDocuments`, `getTrashDocuments`,
 * `searchLibraryDocuments`, and `getOverview`'s document count) can find a
 * workspace's documents without a sequential scan over the entire table.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('idx_documents_workspace_id')
    .on('documents')
    .column('workspace_id')
    .execute();
}

/**
 * Drops the workspace_id index, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_documents_workspace_id').execute();
}
