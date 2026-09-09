import { Kysely } from 'kysely';

/**
 * Adds a nullable `pinned_at` timestamptz column to `document_user_metadata`.
 * Null means the document is not pinned for that user; a timestamp records
 * when they pinned it, so the pinned list can be ordered by most-recently-
 * pinned first, mirroring `last_visited_at`/`last_edited_at`.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('document_user_metadata')
    .addColumn('pinned_at', 'timestamptz')
    .execute();
}

/**
 * Drops the `pinned_at` column from `document_user_metadata`, reversing the
 * up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('document_user_metadata')
    .dropColumn('pinned_at')
    .execute();
}
