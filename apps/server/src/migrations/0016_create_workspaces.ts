import { Kysely, sql } from 'kysely';

/**
 * Creates the workspaces table. Every workspace (personal or custom) has
 * per-role document access defaults that feed the access resolution chain.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('workspaces')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('owner_id', 'integer', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('type', 'text', (col) =>
      col.notNull().check(sql`type IN ('personal', 'custom')`),
    )
    .addColumn('admin_doc_access', 'text', (col) =>
      col
        .notNull()
        .defaultTo('admin')
        .check(
          sql`admin_doc_access IN ('admin', 'editor', 'viewer', 'noAccess')`,
        ),
    )
    .addColumn('member_doc_access', 'text', (col) =>
      col
        .notNull()
        .defaultTo('editor')
        .check(
          sql`member_doc_access IN ('admin', 'editor', 'viewer', 'noAccess')`,
        ),
    )
    .addColumn('non_member_doc_access', 'text', (col) =>
      col
        .notNull()
        .defaultTo('noAccess')
        .check(
          sql`non_member_doc_access IN ('admin', 'editor', 'viewer', 'noAccess')`,
        ),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

/**
 * Drops the workspaces table.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('workspaces').execute();
}
