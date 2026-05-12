import { Kysely, sql } from 'kysely';

/**
 * Adds per-role document-level access overrides to `documents`. When NULL,
 * the corresponding workspace-level default is used instead. When set, they
 * override the workspace default for all users at that role level.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('admin_doc_access', 'text', (col) =>
      col.check(
        sql`admin_doc_access IN ('admin', 'editor', 'viewer', 'noAccess')`,
      ),
    )
    .execute();

  await db.schema
    .alterTable('documents')
    .addColumn('member_doc_access', 'text', (col) =>
      col.check(
        sql`member_doc_access IN ('admin', 'editor', 'viewer', 'noAccess')`,
      ),
    )
    .execute();

  await db.schema
    .alterTable('documents')
    .addColumn('non_member_doc_access', 'text', (col) =>
      col.check(
        sql`non_member_doc_access IN ('admin', 'editor', 'viewer', 'noAccess')`,
      ),
    )
    .execute();
}

/**
 * Drops the document-level override columns.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .dropColumn('admin_doc_access')
    .execute();

  await db.schema
    .alterTable('documents')
    .dropColumn('member_doc_access')
    .execute();

  await db.schema
    .alterTable('documents')
    .dropColumn('non_member_doc_access')
    .execute();
}
