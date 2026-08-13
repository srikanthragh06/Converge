import { Kysely } from 'kysely';

/**
 * Creates the `document_checkpoint_contributors` table, a join table recording
 * which users contributed edits leading up to a given checkpoint row in
 * `document_updates` (where `is_checkpoint = true`). Populated at
 * checkpoint-creation time from `document_user_metadata.last_edited_at`,
 * bounded by the previous checkpoint's timestamp and this one's.
 *
 * - `(update_id, user_id)` is the composite primary key.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('document_checkpoint_contributors')
    .addColumn('update_id', 'bigint', (col) =>
      col.notNull().references('document_updates.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'bigint', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addPrimaryKeyConstraint('document_checkpoint_contributors_pkey', [
      'update_id',
      'user_id',
    ])
    .execute();
}

/**
 * Drops the `document_checkpoint_contributors` table.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('document_checkpoint_contributors').execute();
}
