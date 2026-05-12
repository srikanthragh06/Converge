import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  GetDocumentResponseDto,
  GetDocumentOverviewResponseDto,
  LibraryDocumentDto,
  GetLibraryDocumentsResponseDto,
  SearchLibraryDocumentsResponseDto,
  hasWorkspaceRole,
  type ResolvedDocumentAccessLevel,
  type WorkspaceRole,
  hasAccess,
} from '@converge/shared';
import { DatabaseService } from '../db/database.service';
import { DocumentAccessService } from './document-access.service';
import { sql } from 'kysely';

@Injectable()
export class DocumentService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly documentAccessService: DocumentAccessService,
  ) {}

  /**
   * Returns the document with the given ID. Throws NotFoundException if the
   * document does not exist or is deleted, and ForbiddenException if the
   * requesting user has less than viewer access.
   * @param documentId - the ID of the document to fetch
   * @param userId - the ID of the authenticated requesting user
   * @returns the document's id, title, and createdAt
   */
  async getDocumentOfUser(
    documentId: number,
    userId: number,
  ): Promise<GetDocumentResponseDto> {
    const db = this.dbService.kysely;

    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    // Fetch the document fields needed for the response.
    const row = await db
      .selectFrom('documents')
      .select(['id', 'title', 'created_at'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Document not found.');

    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      resolvedAccess: access,
    };
  }

  /**
   * Creates a new document and its initial metadata row in a single transaction,
   * returning the new document's ID. The user must have at least the member role
   * in the target workspace.
   * @param userId - the ID of the authenticated user who will own the document
   * @param workspaceId - the workspace the document belongs to
   * @returns the newly created document's ID
   */
  async createNewDocument(
    userId: number,
    workspaceId: number,
  ): Promise<number> {
    const db = this.dbService.kysely;

    // Verify the user is a workspace member (owner, admin, or member).
    const memberRow = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (
      !memberRow ||
      !hasWorkspaceRole(memberRow.role as WorkspaceRole, 'member')
    ) {
      throw new ForbiddenException(
        'You must be a member of the workspace to create documents.',
      );
    }

    // Wrap in a transaction so the document and its metadata row are always
    // created together — the metadata seeds the creator's timestamps so the
    // document appears in their library immediately with proper tracking.
    const row = await db.transaction().execute(async (tx) => {
      const documentRow = await tx
        .insertInto('documents')
        .values({
          creator_id: userId,
          workspace_id: workspaceId,
        })
        .returning('documents.id')
        .executeTakeFirst();

      if (!documentRow)
        throw new InternalServerErrorException('Failed to create document.');

      // Initialise metadata so the creator has timestamps from the start.
      await tx
        .insertInto('document_user_metadata')
        .values({ document_id: documentRow.id, user_id: userId })
        .execute();

      return documentRow;
    });

    return row.id;
  }

  /**
   * Returns overview metadata for the given document: title, creator and owner
   * name and email, and creation date. Throws NotFoundException if the document
   * does not exist or is deleted, and ForbiddenException if the requesting user
   * has less than viewer access.
   * @param documentId - the document to fetch overview data for
   * @param userId - the authenticated user performing the request
   * @returns overview metadata for the document
   */
  async getDocumentOverview(
    documentId: number,
    userId: number,
  ): Promise<GetDocumentOverviewResponseDto> {
    const db = this.dbService.kysely;

    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    // Fetch the document fields needed for the overview response.
    const docRow = await db
      .selectFrom('documents')
      .select(['title', 'creator_id', 'created_at'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');

    // The workspace owner is the effective document owner.
    const workspaceRow = await db
      .selectFrom('documents as d')
      .innerJoin('workspace_members as wm', 'wm.workspace_id', 'd.workspace_id')
      .select(['wm.user_id'])
      .where('d.id', '=', documentId)
      .where('wm.role', '=', 'owner')
      .executeTakeFirst();

    if (!workspaceRow)
      throw new NotFoundException('Workspace owner not found.');

    const ownerRow = await db
      .selectFrom('users')
      .select(['name', 'email'])
      .where('id', '=', workspaceRow.user_id)
      .executeTakeFirst();

    if (!ownerRow) throw new NotFoundException('Owner not found.');

    const creatorRow = await db
      .selectFrom('users')
      .select(['name', 'email'])
      .where('id', '=', docRow.creator_id)
      .executeTakeFirst();

    if (!creatorRow) throw new NotFoundException('Creator not found.');

    return {
      title: docRow.title,
      creatorName: creatorRow.name,
      creatorEmail: creatorRow.email,
      ownerName: ownerRow.name,
      ownerEmail: ownerRow.email,
      createdAt: docRow.created_at,
    };
  }

  /**
   * Soft-deletes the document by setting is_deleted and deleted_at. Throws
   * NotFoundException if the document does not exist or is already deleted, and
   * ForbiddenException if the requesting user has less than admin access.
   * @param documentId - the document to soft-delete
   * @param userId - the authenticated user performing the deletion
   */
  async deleteDocument(documentId: number, userId: number): Promise<void> {
    const db = this.dbService.kysely;

    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'admin'))
      throw new ForbiddenException(
        'You must have admin access to delete this document.',
      );

    // Mark the document as deleted without removing any rows.
    await db
      .updateTable('documents')
      .set({ is_deleted: true, deleted_at: new Date() })
      .where('id', '=', documentId)
      .execute();
  }

  /**
   * Returns a paginated list of documents in the given workspace that the user
   * has viewer+ access to, ordered by last_visited_at DESC NULLS LAST with id
   * DESC as a tiebreaker. Uses keyset pagination via a compound cursor.
   *
   * Access is resolved in a subquery CASE expression, then the outer query
   * filters to viewer+ and applies ordering and pagination.
   *
   * @param userId - the authenticated user whose library to list
   * @param workspaceId - the workspace to scope the library to
   * @param limit - maximum number of documents to return
   * @param cursor - compound cursor from the previous page; omit for the first page
   * @returns documents for this page and the nextCursor to fetch the following page
   */
  async getLibraryDocuments(
    userId: number,
    workspaceId: number,
    limit: number,
    cursor?: { lastVisitedAt: Date | null; id: number },
  ): Promise<GetLibraryDocumentsResponseDto> {
    const db = this.dbService.kysely;

    // Inner subquery: join all tables and compute the resolved access level.
    const inner = db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .leftJoin('document_user_metadata as dum', (join) =>
        join
          .onRef('dum.document_id', '=', 'd.id')
          .on('dum.user_id', '=', userId),
      )
      .leftJoin('workspace_members as wm', (join) =>
        join
          .onRef('wm.workspace_id', '=', 'd.workspace_id')
          .on('wm.user_id', '=', userId),
      )
      .leftJoin('document_access as da', (join) =>
        join.onRef('da.document_id', '=', 'd.id').on('da.user_id', '=', userId),
      )
      .select([
        'd.id',
        'd.title',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
        sql<ResolvedDocumentAccessLevel>`
          CASE
            WHEN wm.role = 'owner' THEN 'owner'
            WHEN da.access IS NOT NULL THEN da.access
            WHEN wm.role = 'admin' THEN COALESCE(d.admin_doc_access, w.admin_doc_access)
            WHEN wm.role = 'member' THEN COALESCE(d.member_doc_access, w.member_doc_access)
            ELSE COALESCE(d.non_member_doc_access, w.non_member_doc_access)
          END
        `.as('access'),
      ])
      .where('d.is_deleted', '=', false)
      .where('d.workspace_id', '=', workspaceId)
      .as('r');

    // Outer query: filter out noAccess, apply ordering and pagination.
    let query = db
      .selectFrom(inner)
      .selectAll()
      .where('r.access', '!=', 'noAccess')
      .orderBy(sql`"r"."lastVisitedAt" DESC NULLS LAST`)
      .orderBy(sql`"r"."id" DESC`)
      .limit(limit);

    // Keyset pagination — handles transition into the NULL lastVisitedAt section.
    if (cursor) {
      query =
        cursor.lastVisitedAt !== null
          ? query.where((eb) =>
              eb.or([
                eb('r.lastVisitedAt', '<', cursor.lastVisitedAt),
                eb.and([
                  eb('r.lastVisitedAt', '=', cursor.lastVisitedAt),
                  eb('r.id', '<', cursor.id),
                ]),
                eb('r.lastVisitedAt', 'is', null),
              ]),
            )
          : query.where('r.id', '<', cursor.id);
    }

    const rows = await query.execute();

    const documents: LibraryDocumentDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      access: row.access,
      lastVisitedAt: row.lastVisitedAt,
      lastEditedAt: row.lastEditedAt,
    }));

    // nextCursor is null when there are no more results.
    const nextCursor =
      rows.length === limit
        ? {
            lastVisitedAt: rows[rows.length - 1].lastVisitedAt,
            id: rows[rows.length - 1].id,
          }
        : null;

    return { documents, nextCursor };
  }

  /**
   * Searches documents in the given workspace the user has viewer+ access to,
   * matching by title using trigram similarity. Empty-title documents are
   * excluded. Uses the same subquery access-resolution pattern as
   * getLibraryDocuments.
   * @param userId - the authenticated user whose library to search
   * @param workspaceId - the workspace to scope the search to
   * @param title - the search query to match against document titles
   * @param limit - maximum number of results to return
   * @returns matching documents ordered by similarity score descending
   */
  async searchLibraryDocuments(
    userId: number,
    workspaceId: number,
    title: string,
    limit: number,
  ): Promise<SearchLibraryDocumentsResponseDto> {
    const db = this.dbService.kysely;

    // Inner subquery: same five-tier resolution as getLibraryDocuments.
    const inner = db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .leftJoin('document_user_metadata as dum', (join) =>
        join
          .onRef('dum.document_id', '=', 'd.id')
          .on('dum.user_id', '=', userId),
      )
      .leftJoin('workspace_members as wm', (join) =>
        join
          .onRef('wm.workspace_id', '=', 'd.workspace_id')
          .on('wm.user_id', '=', userId),
      )
      .leftJoin('document_access as da', (join) =>
        join.onRef('da.document_id', '=', 'd.id').on('da.user_id', '=', userId),
      )
      .select([
        'd.id',
        'd.title',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
        sql<ResolvedDocumentAccessLevel>`
          CASE
            WHEN wm.role = 'owner' THEN 'owner'
            WHEN da.access IS NOT NULL THEN da.access
            WHEN wm.role = 'admin' THEN COALESCE(d.admin_doc_access, w.admin_doc_access)
            WHEN wm.role = 'member' THEN COALESCE(d.member_doc_access, w.member_doc_access)
            ELSE COALESCE(d.non_member_doc_access, w.non_member_doc_access)
          END
        `.as('access'),
        sql<number>`similarity(d.title, ${title})`.as('score'),
      ])
      .where('d.is_deleted', '=', false)
      .where('d.workspace_id', '=', workspaceId)
      .where('d.title', '!=', '')
      .as('r');

    // Outer query: filter out noAccess and order by similarity.
    const rows = await db
      .selectFrom(inner)
      .selectAll()
      .where('r.access', '!=', 'noAccess')
      .orderBy('r.score', 'desc')
      .limit(limit)
      .execute();

    const documents: LibraryDocumentDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      access: row.access,
      lastVisitedAt: row.lastVisitedAt,
      lastEditedAt: row.lastEditedAt,
    }));

    return { documents };
  }
}
