import { Kysely } from 'kysely';

/**
 * Adds a NOT NULL `title` column (text, default empty string) to the
 * `documents` table. The default ensures existing rows get an empty title
 * without requiring a backfill.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('title', 'text', (col) => col.notNull().defaultTo(''))
    .execute();
}

/**
 * Drops the `title` column from `documents`, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('documents').dropColumn('title').execute();
}
