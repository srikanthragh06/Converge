import { Kysely } from 'kysely';

/**
 * Adds `owner_id` to `documents` as a NOT NULL foreign key referencing `users.id`.
 * Unlike `creator_id` (immutable), `owner_id` can be transferred to another user.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('owner_id', 'bigint', (col) => col.notNull().references('users.id'))
    .execute();

  await db.schema
    .createIndex('idx_documents_owner_id')
    .on('documents')
    .column('owner_id')
    .execute();
}

/**
 * Drops the index and `owner_id` column from `documents`.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_documents_owner_id').execute();
  await db.schema.alterTable('documents').dropColumn('owner_id').execute();
}
