import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DocumentAccessLevel,
  type ResolvedDocumentAccessLevel,
} from '@converge/shared';
import { DatabaseService } from '../db/database.service';

@Injectable()
export class DocumentAccessService {
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Resolves the effective access level for a user on a document. Resolution
   * order: workspace owner → explicit document_access row → document-level
   * per-role override → workspace-level per-role default.
   * Throws NotFoundException if the document does not exist or is deleted.
   * @param documentId - the document to resolve access for
   * @param userId - the user whose access level to resolve
   * @returns the resolved access level
   */
  async resolveAccess(
    documentId: number,
    userId: number,
  ): Promise<ResolvedDocumentAccessLevel> {
    const db = this.dbService.kysely;

    // Step 1: fetch the document — verify it exists and is not deleted.
    const docRow = await db
      .selectFrom('documents')
      .select([
        'workspace_id',
        'admin_doc_access',
        'member_doc_access',
        'non_member_doc_access',
      ])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');

    // Step 2: workspace owner gets unconditional owner access.
    const memberRow = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', docRow.workspace_id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (memberRow?.role === 'owner') return 'owner';

    // Step 3: check for an explicit per-user document_access row.
    const explicitRow = await db
      .selectFrom('document_access')
      .select('access')
      .where('document_id', '=', documentId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (explicitRow) return explicitRow.access as DocumentAccessLevel;

    // Step 4: check for a document-level per-role override.
    const role = memberRow?.role ?? null;

    if (role === 'admin' && docRow.admin_doc_access != null) {
      return docRow.admin_doc_access;
    }
    if (role === 'member' && docRow.member_doc_access != null) {
      return docRow.member_doc_access;
    }
    if (!role && docRow.non_member_doc_access != null) {
      return docRow.non_member_doc_access;
    }

    // Step 5: fall back to workspace-level per-role defaults.
    const wsRow = await db
      .selectFrom('workspaces')
      .select([
        'admin_doc_access',
        'member_doc_access',
        'non_member_doc_access',
      ])
      .where('id', '=', docRow.workspace_id)
      .executeTakeFirstOrThrow();

    if (role === 'admin') return wsRow.admin_doc_access as DocumentAccessLevel;
    if (role === 'member')
      return wsRow.member_doc_access as DocumentAccessLevel;
    return wsRow.non_member_doc_access as DocumentAccessLevel;
  }
}
