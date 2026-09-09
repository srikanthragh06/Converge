import { Kysely, sql } from 'kysely';

/**
 * Adds the incrementally-maintained BM25 ingredients the indexing pipeline
 * tracks but retrieval alone can't derive per-query — tsvector/GIN can find
 * which chunks share vocabulary with a query, but real BM25 scoring also
 * needs corpus-wide statistics (how many chunks contain a term, how long
 * chunks are on average) that no single row carries. Rather than scan the
 * whole corpus per query to compute those, they're tracked as running
 * counters here, updated by DocumentIndexingService's existing diff-and-
 * rewrite transaction whenever chunks are added or removed.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Backs both document_chunk_corpus_stats' average-length stat and (later)
  // BM25's own per-chunk length-normalization term — computed once at chunk
  // creation via the same tokenizer already used for chunk sizing, not
  // re-derived per query.
  await db.schema
    .alterTable('document_chunks')
    .addColumn('token_count', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();

  // Backs the term lookups both this migration's stats and future retrieval
  // need. GENERATED ALWAYS keeps it in sync with content automatically, so
  // no application code ever writes to it directly. Kysely's schema builder
  // has no generated-column support, so this drops into raw sql, same as
  // the vector(1536) column in the previous migration.
  await sql`
    ALTER TABLE document_chunks
    ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
  `.execute(db);

  await sql`
    CREATE INDEX idx_document_chunks_content_tsv
    ON document_chunks USING gin(content_tsv)
  `.execute(db);

  // Document frequency per term, scoped to a workspace (retrieval is
  // workspace-scoped, so "corpus" here means one workspace's chunks) — the
  // IDF ingredient tsvector/ts_rank_cd has no equivalent for. Maintained as
  // a running counter rather than computed live: incremented for every
  // distinct term in a newly-indexed chunk, decremented for every distinct
  // term in a chunk being removed, with the row deleted once it reaches
  // zero so an absent row cleanly means "this term doesn't exist in this
  // workspace" rather than a lingering zero.
  await db.schema
    .createTable('document_chunk_term_stats')
    .addColumn('workspace_id', 'integer', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('term', 'text', (col) => col.notNull())
    .addColumn('document_frequency', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .addPrimaryKeyConstraint('document_chunk_term_stats_pkey', [
      'workspace_id',
      'term',
    ])
    .execute();

  // Running totals backing average chunk length (total_tokens /
  // total_chunks) — BM25's other corpus-wide ingredient, alongside document
  // frequency above. One row per workspace, updated by the same delta the
  // term stats above are updated by.
  await db.schema
    .createTable('document_chunk_corpus_stats')
    .addColumn('workspace_id', 'integer', (col) =>
      col.primaryKey().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('total_chunks', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('total_tokens', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
}

/**
 * Reverses the up migration — drops both new stats tables and the
 * token_count/content_tsv columns (content_tsv's GIN index is dropped
 * implicitly along with the column).
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('document_chunk_corpus_stats').execute();
  await db.schema.dropTable('document_chunk_term_stats').execute();
  await db.schema
    .alterTable('document_chunks')
    .dropColumn('content_tsv')
    .execute();
  await db.schema
    .alterTable('document_chunks')
    .dropColumn('token_count')
    .execute();
}
