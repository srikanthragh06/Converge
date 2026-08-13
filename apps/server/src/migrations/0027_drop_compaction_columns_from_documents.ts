import { Kysely } from 'kysely';

/**
 * Drops `update_count` and `last_compact_count` from `documents`. Both
 * existed solely to drive the old count-based `document_updates` compaction,
 * which is replaced by checkpoint-driven merging (see the `is_checkpoint`
 * migration) — nothing else reads or writes these columns.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('documents').dropColumn('update_count').execute();
  await db.schema
    .alterTable('documents')
    .dropColumn('last_compact_count')
    .execute();
}

/**
 * Restores both dropped columns, defaulting to 0. Historical counts are not
 * recoverable — this is only enough to satisfy the old compaction code path
 * if it were ever reinstated.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('update_count', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
  await db.schema
    .alterTable('documents')
    .addColumn('last_compact_count', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .execute();
}
