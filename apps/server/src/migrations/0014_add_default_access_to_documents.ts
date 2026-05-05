import { Kysely, sql } from 'kysely';

/**
 * Adds a `default_access` column to the `documents` table. This column stores
 * the fallback access level for users who have no explicit row in `document_access`.
 *
 * - `default_access` is one of: 'admin', 'editor', 'viewer', 'noAccess'.
 * - Defaults to 'noAccess' (private by default).
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('documents')
    .addColumn('default_access', 'text', (col) =>
      col
        .notNull()
        .defaultTo('noAccess')
        .check(
          sql`default_access IN ('admin', 'editor', 'viewer', 'noAccess')`,
        ),
    )
    .execute();
}

/**
 * Drops the `default_access` column from the `documents` table.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('documents').dropColumn('default_access').execute();
}
