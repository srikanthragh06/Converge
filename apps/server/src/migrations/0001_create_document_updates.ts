import { Kysely, sql } from 'kysely';

/**
 * Creates the document_updates table, which stores raw Yjs binary update
 * payloads. Each row is one incremental update produced by a client; the full
 * document state is reconstructed by merging all updates for a document.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('document_updates')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    // Raw Yjs binary update payload produced by a collaborating client.
    .addColumn('update', 'bytea', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

/**
 * Drops the document_updates table, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('document_updates').execute();
}
