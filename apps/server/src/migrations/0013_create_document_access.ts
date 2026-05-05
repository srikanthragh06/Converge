import { Kysely, sql } from 'kysely';

/**
 * Creates the `document_access` table, which stores per-user access levels for
 * documents. The owner is not stored here — ownership is tracked via `documents.owner_id`.
 *
 * - `access` is one of: 'admin', 'editor', 'viewer', 'noAccess'.
 * - (document_id, user_id) is the composite primary key.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('document_access')
    .addColumn('document_id', 'integer', (col) =>
      col.notNull().references('documents.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('access', 'text', (col) =>
      col.notNull().check(sql`access IN ('admin', 'editor', 'viewer', 'noAccess')`),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint('document_access_pkey', ['document_id', 'user_id'])
    .execute();
}

/**
 * Drops the `document_access` table.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('document_access').execute();
}
