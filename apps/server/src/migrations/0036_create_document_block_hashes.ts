import { Kysely, sql } from 'kysely';

/**
 * Creates the `document_block_hashes` table — per-block content
 * fingerprints used by the RAG indexing pipeline to detect changed/added/
 * deleted blocks between indexing runs.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('document_block_hashes')
    .addColumn('document_id', 'bigint', (col) =>
      col.notNull().references('documents.id').onDelete('cascade'),
    )
    .addColumn('block_id', 'text', (col) => col.notNull())
    .addColumn('hash', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint('document_block_hashes_pkey', [
      'document_id',
      'block_id',
    ])
    .execute();
}

/**
 * Drops the `document_block_hashes` table, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('document_block_hashes').execute();
}
