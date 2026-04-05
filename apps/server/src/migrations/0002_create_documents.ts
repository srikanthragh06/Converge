import { Kysely, sql } from 'kysely';

/**
 * Creates the documents table, which tracks per-document metadata used for
 * compaction. `update_count` is incremented on every persisted Yjs update;
 * `last_compact_count` records the value of `update_count` at the time of the
 * last compaction, allowing the compaction logic to determine when the
 * threshold has been crossed again.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('documents')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('update_count', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn('last_compact_count', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

/**
 * Drops the documents table, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('documents').execute();
}
