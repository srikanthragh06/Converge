import { Kysely, sql } from 'kysely';

/**
 * Adds `is_checkpoint` to `document_updates`, marking rows that represent a
 * version-history checkpoint rather than a single unfolded edit. When a
 * checkpoint is taken, every row since the previous checkpoint (or the
 * beginning, if none exists) is merged into one new row and flagged
 * `is_checkpoint = true`; the individual rows just folded into it are then
 * deleted. This replaces the old count-based compaction — there is only one
 * merge mechanism now, driven by the checkpoint schedule instead of a raw
 * update-count threshold.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('document_updates')
    .addColumn('is_checkpoint', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute();

  await db.schema
    .createIndex('idx_document_updates_document_id_is_checkpoint')
    .on('document_updates')
    .columns(['document_id', 'id'])
    .where(sql.ref('is_checkpoint'), '=', true)
    .execute();
}

/**
 * Drops the `is_checkpoint` column and its index, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('idx_document_updates_document_id_is_checkpoint')
    .execute();
  await db.schema
    .alterTable('document_updates')
    .dropColumn('is_checkpoint')
    .execute();
}
