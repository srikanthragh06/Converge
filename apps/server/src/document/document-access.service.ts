import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentAccessLevel,
  type ResolvedDocumentAccessLevel,
  type GetDocumentRoleOverridesResponseDto,
  type UpdateDocumentRoleOverridesRequestDto,
  type UpdateDocumentRoleOverridesResponseDto,
  type GetDocumentAccessResponseDto,
  type SearchDocumentAccessUsersResponseDto,
  type FindNewDocumentAccessUserResponseDto,
  type DocumentAccessUserDto,
  hasAccess,
} from '@converge/shared';
import { DatabaseService } from '../db/database.service';
import { sql } from 'kysely';

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

  /**
   * Returns the document's per-role access overrides alongside the workspace
   * defaults, so the client can display what each null value inherits.
   * Requires resolved document viewer+.
   * @param documentId - the document to query
   * @param userId - the authenticated user (must have viewer+ resolved access)
   * @returns per-role doc overrides, workspace defaults, and workspace name
   */
  async getRoleOverrides(
    documentId: number,
    userId: number,
  ): Promise<GetDocumentRoleOverridesResponseDto> {
    const db = this.dbService.kysely;

    const resolvedAccess = await this.resolveAccess(documentId, userId);
    if (!hasAccess(resolvedAccess, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    // Fetch the document joined with its workspace in one query.
    const row = await db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .select([
        'd.workspace_id',
        'd.admin_doc_access',
        'd.member_doc_access',
        'd.non_member_doc_access',
        'w.name as workspaceName',
        'w.admin_doc_access as wsAdminDocAccess',
        'w.member_doc_access as wsMemberDocAccess',
        'w.non_member_doc_access as wsNonMemberDocAccess',
      ])
      .where('d.id', '=', documentId)
      .where('d.is_deleted', '=', false)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Document not found.');

    return {
      adminDocAccess: row.admin_doc_access,
      memberDocAccess: row.member_doc_access,
      nonMemberDocAccess: row.non_member_doc_access,
      workspaceAdminDocAccess: row.wsAdminDocAccess as DocumentAccessLevel,
      workspaceMemberDocAccess: row.wsMemberDocAccess as DocumentAccessLevel,
      workspaceNonMemberDocAccess:
        row.wsNonMemberDocAccess as DocumentAccessLevel,
      workspaceName: row.workspaceName,
    };
  }

  /**
   * Updates the document's per-role access overrides. A null value resets
   * that role to the workspace default. Requires resolved document admin+.
   * @param documentId - the document to update
   * @param userId - the authenticated user (must have admin+ resolved access)
   * @param body - fields to update; at least one required; null resets to workspace default
   * @returns the three per-role overrides after update
   */
  async updateRoleOverrides(
    documentId: number,
    userId: number,
    body: UpdateDocumentRoleOverridesRequestDto,
  ): Promise<UpdateDocumentRoleOverridesResponseDto> {
    const db = this.dbService.kysely;

    // Verify document exists and caller has admin+ resolved access.
    const access = await this.resolveAccess(documentId, userId);
    if (!hasAccess(access, 'admin'))
      throw new ForbiddenException('You do not have access to this document.');

    // Build a partial update — undefined means omit, null means reset to workspace default.
    const patch: {
      admin_doc_access?: DocumentAccessLevel | null;
      member_doc_access?: DocumentAccessLevel | null;
      non_member_doc_access?: DocumentAccessLevel | null;
    } = {};
    if (body.adminDocAccess !== undefined)
      patch.admin_doc_access = body.adminDocAccess;
    if (body.memberDocAccess !== undefined)
      patch.member_doc_access = body.memberDocAccess;
    if (body.nonMemberDocAccess !== undefined)
      patch.non_member_doc_access = body.nonMemberDocAccess;

    const updated = await db
      .updateTable('documents')
      .set(patch)
      .where('id', '=', documentId)
      .returning([
        'admin_doc_access',
        'member_doc_access',
        'non_member_doc_access',
      ])
      .executeTakeFirstOrThrow();

    return {
      adminDocAccess: updated.admin_doc_access,
      memberDocAccess: updated.member_doc_access,
      nonMemberDocAccess: updated.non_member_doc_access,
    };
  }

  /**
   * Returns a keyset-paginated list of per-user access entries for the document.
   * Ordered by user_id ASC. Requires resolved document viewer+.
   * @param documentId - the document to list access for
   * @param userId - the authenticated user (must have viewer+ resolved access)
   * @param limit - maximum entries per page
   * @param cursorId - last user_id from the previous page; omit for the first page
   * @returns users array and nextCursor (null on the last page)
   */
  async getAccessUsers(
    documentId: number,
    userId: number,
    limit: number,
    cursorId?: number,
  ): Promise<GetDocumentAccessResponseDto> {
    const db = this.dbService.kysely;

    // Verify document exists and caller has viewer+ resolved access.
    const access = await this.resolveAccess(documentId, userId);
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    // Keyset-paginated query ordered by user_id ASC.
    let query = db
      .selectFrom('document_access as da')
      .innerJoin('users as u', 'u.id', 'da.user_id')
      .select(['u.id', 'u.name', 'u.email', 'u.avatar_url', 'da.access'])
      .where('da.document_id', '=', documentId)
      .orderBy('da.user_id', 'asc')
      .limit(limit);

    if (cursorId !== undefined) {
      query = query.where('da.user_id', '>', cursorId);
    }

    const rows = await query.execute();
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return {
      users: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        avatarUrl: r.avatar_url,
        access: r.access as DocumentAccessLevel,
      })),
      nextCursor,
    };
  }

  /**
   * Searches per-user access entries by email using trigram similarity.
   * Requires resolved document viewer+.
   * @param documentId - the document to search within
   * @param userId - the authenticated user (must have viewer+ resolved access)
   * @param email - the email query to match against
   * @returns matching users ordered by similarity score descending
   */
  async searchAccessUsers(
    documentId: number,
    userId: number,
    email: string,
  ): Promise<SearchDocumentAccessUsersResponseDto> {
    const db = this.dbService.kysely;

    const access = await this.resolveAccess(documentId, userId);
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    const rows = await db
      .selectFrom('document_access as da')
      .innerJoin('users as u', 'u.id', 'da.user_id')
      .select([
        'u.id',
        'u.name',
        'u.email',
        'u.avatar_url',
        'da.access',
        sql<number>`similarity(u.email, ${email})`.as('score'),
      ])
      .where('da.document_id', '=', documentId)
      .orderBy('score', 'desc')
      .limit(5)
      .execute();

    return {
      users: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        avatarUrl: r.avatar_url,
        access: r.access as DocumentAccessLevel,
      })),
    };
  }

  /**
   * Looks up a user by exact email who has no explicit document_access row
   * and is not the workspace owner. Used to populate the "add user" card
   * before the caller selects an access level.
   * Requires resolved document admin+.
   * @param documentId - the document to check against
   * @param userId - the authenticated user (must have admin+ resolved access)
   * @param email - the exact email address to look up
   * @returns the matched user's profile
   * @throws 404 if the user is not found
   * @throws 409 if the user is the workspace owner or already has an access row
   */
  async findNewAccessUser(
    documentId: number,
    userId: number,
    email: string,
  ): Promise<FindNewDocumentAccessUserResponseDto> {
    const db = this.dbService.kysely;

    const access = await this.resolveAccess(documentId, userId);
    if (!hasAccess(access, 'admin'))
      throw new ForbiddenException('You do not have access to this document.');

    // Fetch the document's workspace owner to exclude them.
    const docRow = await db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .select('w.owner_id')
      .where('d.id', '=', documentId)
      .executeTakeFirstOrThrow();

    // Find the target user by exact email.
    const userRow = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'avatar_url'])
      .where('email', '=', email)
      .executeTakeFirst();

    if (!userRow) throw new NotFoundException('User not found.');

    // Workspace owner already has unconditional owner access — no row needed.
    if (userRow.id === docRow.owner_id)
      throw new ConflictException('User already has access.');

    // Reject if an explicit access row already exists.
    const existing = await db
      .selectFrom('document_access')
      .select('user_id')
      .where('document_id', '=', documentId)
      .where('user_id', '=', userRow.id)
      .executeTakeFirst();

    if (existing) throw new ConflictException('User already has access.');

    return {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      avatarUrl: userRow.avatar_url,
    };
  }

  /**
   * Upserts a per-user document_access row granting the target user a specific
   * access level. Requires resolved document admin+. Granting admin access
   * additionally requires resolved owner — admins cannot create more admins.
   * @param documentId - the document to grant access on
   * @param userId - the authenticated user (must have admin+ resolved access)
   * @param targetUserId - the user to grant access to
   * @param access - the access level to grant
   * @returns the target user's profile with their new access level
   * @throws 404 if the target user is not found
   * @throws 409 if the target user is the workspace owner
   */
  async setUserAccess(
    documentId: number,
    userId: number,
    targetUserId: number,
    access: DocumentAccessLevel,
  ): Promise<DocumentAccessUserDto> {
    const db = this.dbService.kysely;

    const callerAccess = await this.resolveAccess(documentId, userId);
    if (!hasAccess(callerAccess, 'admin'))
      throw new ForbiddenException('You do not have access to this document.');

    // Only the document owner may grant admin access.
    if (access === 'admin' && callerAccess !== 'owner')
      throw new ForbiddenException(
        'Only the document owner can grant admin access.',
      );

    // Fetch the workspace owner — they cannot be given an explicit access row.
    const docRow = await db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .select('w.owner_id')
      .where('d.id', '=', documentId)
      .executeTakeFirstOrThrow();

    if (targetUserId === docRow.owner_id)
      throw new ConflictException(
        'Cannot override access for the workspace owner.',
      );

    // Look up the target user's profile for the response.
    const targetUser = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'avatar_url'])
      .where('id', '=', targetUserId)
      .executeTakeFirst();

    if (!targetUser) throw new NotFoundException('User not found.');

    // Upsert — insert or update the access level if a row already exists.
    await db
      .insertInto('document_access')
      .values({ document_id: documentId, user_id: targetUserId, access })
      .onConflict((oc) =>
        oc.columns(['document_id', 'user_id']).doUpdateSet({ access }),
      )
      .execute();

    return {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      avatarUrl: targetUser.avatar_url,
      access,
    };
  }

  /**
   * Deletes a single per-user document_access row. Requires resolved document
   * admin+. Revoking admin access additionally requires resolved owner —
   * admins cannot revoke other admins.
   * @param documentId - the document to remove access on
   * @param userId - the authenticated user (must have admin+ resolved access)
   * @param targetUserId - the user whose access row to remove
   * @throws 404 if no access row exists for the target user
   * @throws 403 if revoking admin access without owner-level resolved access
   */
  async removeUserAccess(
    documentId: number,
    userId: number,
    targetUserId: number,
  ): Promise<void> {
    const db = this.dbService.kysely;

    const callerAccess = await this.resolveAccess(documentId, userId);
    if (!hasAccess(callerAccess, 'admin'))
      throw new ForbiddenException('You do not have access to this document.');

    // Fetch the target's current access level before deleting.
    const targetRow = await db
      .selectFrom('document_access')
      .select('access')
      .where('document_id', '=', documentId)
      .where('user_id', '=', targetUserId)
      .executeTakeFirst();

    if (!targetRow) throw new NotFoundException('Access entry not found.');

    // Only the document owner may revoke admin access.
    if (targetRow.access === 'admin' && callerAccess !== 'owner')
      throw new ForbiddenException(
        'Only the document owner can revoke admin access.',
      );

    await db
      .deleteFrom('document_access')
      .where('document_id', '=', documentId)
      .where('user_id', '=', targetUserId)
      .execute();
  }
}
