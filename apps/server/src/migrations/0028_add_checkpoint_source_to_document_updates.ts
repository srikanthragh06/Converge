import { Kysely, sql } from 'kysely';

/**
 * Adds `checkpoint_source` to `document_updates`, recording what triggered a
 * checkpoint row: a manual save, or one of the two automatic scheduler
 * timers (idle, interval). Nullable — meaningless for the vast majority of
 * rows, which are raw unfolded edits rather than checkpoints.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('document_updates')
    .addColumn('checkpoint_source', 'text', (col) =>
      col.check(
        sql`checkpoint_source IS NULL OR checkpoint_source IN ('manual', 'idle', 'interval')`,
      ),
    )
    .execute();
}

/**
 * Drops the `checkpoint_source` column, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('document_updates')
    .dropColumn('checkpoint_source')
    .execute();
}
