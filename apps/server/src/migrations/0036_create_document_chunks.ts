import { Kysely, sql } from 'kysely';

/**
 * Creates the `document_chunks` table — embedded, searchable text chunks
 * used by the RAG indexing pipeline. Also enables the `pgvector` extension,
 * which `embedding` depends on. Kysely's schema builder has no native
 * vector type or HNSW index support, so both drop into raw `sql` where
 * needed.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable('document_chunks')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('document_id', 'bigint', (col) =>
      col.notNull().references('documents.id').onDelete('cascade'),
    )
    // Denormalized from documents.workspace_id — retrieval-time access
    // filtering needs it directly on this table, not via a join.
    .addColumn('workspace_id', 'integer', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('block_ids', sql`text[]`, (col) => col.notNull())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('embedding', sql`vector(1536)`, (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // HNSW: approximate-nearest-neighbor index for cosine similarity search
  // (the `<=>` operator). Built now, while the table is empty, so there's
  // no bulk-build cost once real content lands.
  await sql`
    CREATE INDEX idx_document_chunks_embedding_hnsw
    ON document_chunks USING hnsw (embedding vector_cosine_ops)
  `.execute(db);

  await db.schema
    .createIndex('idx_document_chunks_document_id')
    .on('document_chunks')
    .column('document_id')
    .execute();

  await db.schema
    .createIndex('idx_document_chunks_workspace_id')
    .on('document_chunks')
    .column('workspace_id')
    .execute();
}

/**
 * Drops `document_chunks` (and its indexes, dropped implicitly with the
 * table), reversing the up migration. Leaves the `vector` extension
 * installed — other tables/future migrations may depend on it, and
 * dropping an extension is a separate, deliberate action.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('document_chunks').execute();
}
