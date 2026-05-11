import { Kysely, sql } from 'kysely';

/**
 * Creates the workspace_members table, which tracks which users belong to
 * which workspace and with what role. The workspace owner is also stored
 * here with role='owner' (alongside workspaces.owner_id).
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('workspace_members')
    .addColumn('workspace_id', 'integer', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('role', 'text', (col) =>
      col.notNull().check(sql`role IN ('owner', 'admin', 'member')`),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addPrimaryKeyConstraint('workspace_members_pkey', [
      'workspace_id',
      'user_id',
    ])
    .execute();
}

/**
 * Drops the workspace_members table.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('workspace_members').execute();
}
