import { Kysely } from 'kysely';

/**
 * Adds `content_last_edited_at` to `document_updates`, recording the
 * timestamp of the most recent edit actually folded into a checkpoint row —
 * distinct from `created_at`, which is when the checkpoint row itself was
 * inserted (can lag content_last_edited_at by up to the idle-trigger delay
 * for automatic checkpoints). Nullable — meaningless for raw, non-checkpoint
 * rows.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('document_updates')
    .addColumn('content_last_edited_at', 'timestamptz')
    .execute();
}

/**
 * Drops the `content_last_edited_at` column, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('document_updates')
    .dropColumn('content_last_edited_at')
    .execute();
}
