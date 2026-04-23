import { Kysely, sql } from 'kysely';

/**
 * Creates the `document_user_metadata` table, which tracks per-user,
 * per-document metadata such as when the user last visited the doc.
 *
 * - `document_id` and `user_id` form the composite primary key.
 * - `last_visited_at` is set on WebSocket connect (when the user opens the doc).
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('document_user_metadata')
    .addColumn('document_id', 'integer', (col) =>
      col.notNull().references('documents.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('last_visited_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('document_user_metadata_pkey', ['document_id', 'user_id'])
    .execute();
}

/**
 * Drops the `document_user_metadata` table, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('document_user_metadata').execute();
}
