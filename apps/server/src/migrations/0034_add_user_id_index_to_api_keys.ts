import { Kysely } from 'kysely';

/**
 * Creates a B-tree index on `api_keys.user_id` so `listApiKeys` can find a
 * user's keys without a sequential scan over the entire table.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('idx_api_keys_user_id')
    .on('api_keys')
    .column('user_id')
    .execute();
}

/**
 * Drops the user_id index, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_api_keys_user_id').execute();
}
