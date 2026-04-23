import { Kysely, sql } from 'kysely';

/**
 * Adds a `last_edited_at` timestamptz column to `document_user_metadata`.
 * The column is updated whenever the user pushes a content or title update,
 * allowing the library UI to show per-user last-edited times per document.
 * The default of `now()` ensures existing rows get a non-null value.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('document_user_metadata')
    .addColumn('last_edited_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

/**
 * Drops the `last_edited_at` column from `document_user_metadata`,
 * reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('document_user_metadata')
    .dropColumn('last_edited_at')
    .execute();
}
