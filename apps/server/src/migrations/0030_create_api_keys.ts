import { Kysely, sql } from 'kysely';

/**
 * Creates the `api_keys` table — long-lived credentials for non-browser
 * callers (MCP, CLI, scripts) that inherit the full permissions of the user
 * they belong to. Only a SHA-256 hash of the raw key is ever stored; the raw
 * key itself is shown to the user once at creation time and is not
 * recoverable afterwards.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('api_keys')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('user_id', 'bigint', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('key_hash', 'text', (col) => col.notNull().unique())
    .addColumn('key_prefix', 'text', (col) => col.notNull())
    .addColumn('label', 'text', (col) => col.notNull())
    .addColumn('last_used_at', 'timestamptz')
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

/**
 * Drops the `api_keys` table.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('api_keys').execute();
}
