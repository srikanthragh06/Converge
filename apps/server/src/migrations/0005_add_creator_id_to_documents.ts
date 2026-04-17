import { Kysely } from 'kysely';

/**
 * Adds `creator_id` to `documents` as a NOT NULL foreign key referencing
 * `users.id`, and creates an index on it. This ties every document to the
 * user who created it, which is the foundation for per-user document scoping
 * and access control.
 *
 * Note: this migration requires the `documents` table to be empty — any
 * existing rows must be cleared first since no default value is provided.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('creator_id', 'bigint', (col) =>
      col.notNull().references('users.id'),
    )
    .execute();

  await db.schema
    .createIndex('idx_documents_creator_id')
    .on('documents')
    .column('creator_id')
    .execute();
}

/**
 * Drops the index and `creator_id` column from `documents`, reversing the up
 * migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_documents_creator_id').execute();

  await db.schema.alterTable('documents').dropColumn('creator_id').execute();
}
