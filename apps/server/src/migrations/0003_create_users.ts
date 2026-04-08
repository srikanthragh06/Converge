import { Kysely, sql } from 'kysely';

/**
 * Creates the users table, which stores accounts authenticated via Google
 * OAuth. `google_id` is the stable identifier from Google's ID token (`sub`
 * claim) and is used to look up existing users on subsequent logins rather
 * than relying on email, which can change.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('google_id', 'varchar', (col) => col.notNull().unique())
    .addColumn('email', 'varchar', (col) => col.notNull().unique())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('avatar_url', 'varchar')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

/**
 * Drops the users table, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('users').execute();
}
