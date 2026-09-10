import { Kysely, sql } from 'kysely';

/**
 * Adds `indexing_status` and `last_indexed_at` to `documents`, so a
 * document's RAG indexing lifecycle is queryable rather than only inferable
 * from the presence of a pending pg-boss job. `indexing_status` defaults to
 * `'idle'` — every existing document is treated as caught up until its next
 * edit schedules a real reindex. `last_indexed_at` starts NULL, since no
 * document has a recorded successful run yet under this new column.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('indexing_status', 'text', (col) =>
      col.notNull().defaultTo('idle'),
    )
    .addColumn('last_indexed_at', 'timestamptz')
    .execute();

  // CHECK constraint (rather than a DB enum type) mirrors DocumentIndexingStatus
  // (packages/shared/src/types/types.ts) without introducing a Postgres enum
  // to keep in sync on every future value change.
  await sql`
    ALTER TABLE documents
    ADD CONSTRAINT documents_indexing_status_check
    CHECK (indexing_status IN ('idle', 'pending', 'indexing'))
  `.execute(db);
}

/**
 * Drops `indexing_status` and `last_indexed_at` from `documents`, reversing
 * the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .dropColumn('indexing_status')
    .dropColumn('last_indexed_at')
    .execute();
}
