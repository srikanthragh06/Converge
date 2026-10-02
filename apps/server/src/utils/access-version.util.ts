import { Kysely, sql } from 'kysely';
import type { DatabaseSchema } from '../db/database.schema.js';

/**
 * Increments a document's doc_access_version. Call it in the same
 * transaction as any write that can change who may access that one document
 * (a grant, revoke, role override, soft-delete or restore), so the change
 * and the signal that makes every open socket re-resolve its access commit
 * together — a missed bump leaves open sockets on their old access.
 * @param db - the Kysely instance or transaction to run the update on
 * @param documentId - the document whose access changed
 */
export async function bumpDocAccessVersion(
  db: Kysely<DatabaseSchema>,
  documentId: number,
): Promise<void> {
  await db
    .updateTable('documents')
    .set({ doc_access_version: sql`doc_access_version + 1` })
    .where('id', '=', documentId)
    .execute();
}

/**
 * Increments a workspace's workspace_access_version. Call it in the same
 * transaction as any write that can change access to all of a workspace's
 * documents (membership, member roles, ownership, default doc access), for
 * the same reason as bumpDocAccessVersion.
 * @param db - the Kysely instance or transaction to run the update on
 * @param workspaceId - the workspace whose access changed
 */
export async function bumpWorkspaceAccessVersion(
  db: Kysely<DatabaseSchema>,
  workspaceId: number,
): Promise<void> {
  await db
    .updateTable('workspaces')
    .set({ workspace_access_version: sql`workspace_access_version + 1` })
    .where('id', '=', workspaceId)
    .execute();
}
