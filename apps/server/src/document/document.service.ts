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
   * @returns the document's id, title, ownerId, and createdAt
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
    if (!this.documentAccessService.hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    // Fetch the document fields needed for the response.
    const row = await db
      .selectFrom('documents')
      .select(['id', 'title', 'owner_id', 'created_at'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Document not found.');

    return {
      id: row.id,
      title: row.title,
      ownerId: row.owner_id,
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
    // created together — a document with no metadata row would break the
    // library query which treats last_visited_at and last_edited_at as non-nullable.
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

      // Create the initial metadata row so the library can always read
      // last_visited_at and last_edited_at without needing a left join.
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
   * name and email, creation date, and the requesting user's last-visited and
   * last-edited timestamps. Throws NotFoundException if the document does not
   * exist or is deleted, and ForbiddenException if the requesting user has less
   * than viewer access.
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
    if (!this.documentAccessService.hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    // Fetch the document fields needed for the overview response.
    const docRow = await db
      .selectFrom('documents')
      .select(['title', 'owner_id', 'creator_id', 'created_at'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');

    const docUserRow = await db
      .selectFrom('document_user_metadata')
      .select([
        sql<Date>`max(last_visited_at)`.as('lastVisitedAt'),
        sql<Date>`max(last_edited_at)`.as('lastEditedAt'),
      ])
      .where('document_id', '=', documentId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    const ownerRow = await db
      .selectFrom('users')
      .select(['name', 'email'])
      .where('id', '=', docRow.owner_id)
      .executeTakeFirst();

    if (!ownerRow) throw new NotFoundException('Owner not found.');

    const creatorRow = await db
      .selectFrom('users')
      .select(['name', 'email'])
      .where('id', '=', docRow.creator_id)
      .executeTakeFirst();

    if (!creatorRow) throw new NotFoundException('Creator not found.');

    // Fall back to now() for users who have no metadata row yet (non-owners
    // who have not yet connected via WebSocket).
    const now = new Date();

    return {
      title: docRow.title,
      creatorName: creatorRow.name,
      creatorEmail: creatorRow.email,
      ownerName: ownerRow.name,
      ownerEmail: ownerRow.email,
      createdAt: docRow.created_at,
      lastVisitedAt: docUserRow?.lastVisitedAt ?? now,
      lastEditedAt: docUserRow?.lastEditedAt ?? now,
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
    if (!this.documentAccessService.hasAccess(access, 'admin'))
      throw new ForbiddenException('You do not have access to this document.');

    // Mark the document as deleted without removing any rows.
    await db
      .updateTable('documents')
      .set({ is_deleted: true, deleted_at: new Date() })
      .where('id', '=', documentId)
      .execute();
  }

  /**
   * Returns a paginated list of documents the user has interacted with and has
   * viewer+ access to, ordered by last_visited_at DESC with id DESC as a
   * tiebreaker. Uses keyset pagination via a compound cursor (lastVisitedAt, id)
   * so performance is consistent regardless of page depth.
   *
   * A document appears only if the user has a document_user_metadata row (i.e.
   * has opened it at least once via WebSocket) AND has viewer+ access via the
   * three-tier resolution: owner > explicit document_access row > default_access.
   *
   * @param userId - the authenticated user whose library to list
   * @param limit - maximum number of documents to return
   * @param cursor - compound cursor from the previous page; omit for the first page
   * @returns documents for this page and the nextCursor to fetch the following page
   */
  async getLibraryDocuments(
    userId: number,
    limit: number,
    cursor?: { lastVisitedAt: Date; id: number },
  ): Promise<GetLibraryDocumentsResponseDto> {
    const db = this.dbService.kysely;

    // document_user_metadata is the "has interacted" gate — only documents the
    // user has opened at least once (creating a metadata row via recordLastVisited)
    // can appear in the library.
    // document_access is left-joined because owners have no explicit access row —
    // their access is implied by documents.owner_id.
    let query = db
      .selectFrom('document_user_metadata as dum')
      .innerJoin('documents as d', 'd.id', 'dum.document_id')
      .leftJoin('document_access as da', (join) =>
        join
          .onRef('da.document_id', '=', 'dum.document_id')
          .on('da.user_id', '=', userId),
      )
      .select([
        'd.id',
        'd.title',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
        // Resolve access using the same three-tier logic as resolveAccess:
        // owner > explicit document_access row > default_access fallback.
        sql<ResolvedDocumentAccessLevel>`
          CASE
            WHEN d.owner_id = ${userId} THEN 'owner'
            WHEN da.access IS NOT NULL THEN da.access
            ELSE d.default_access
          END
        `.as('access'),
      ])
      .where('dum.user_id', '=', userId)
      .where('d.is_deleted', '=', false)
      // Include the document only if the user has viewer+ access.
      // da.user_id IS NULL means no explicit row exists — fall back to default_access.
      .where(({ eb, or, and }) =>
        or([
          eb('d.owner_id', '=', userId),
          and([
            eb('da.user_id', 'is not', null),
            eb('da.access', '!=', 'noAccess'),
          ]),
          and([
            eb('da.user_id', 'is', null),
            eb('d.default_access', '!=', 'noAccess'),
          ]),
        ]),
      )
      .orderBy('dum.last_visited_at', 'desc')
      .orderBy('d.id', 'desc')
      .limit(limit);

    // Apply the compound cursor to fetch only rows after the last seen position.
    if (cursor) {
      query = query.where(({ eb, and, or }) =>
        or([
          eb('dum.last_visited_at', '<', cursor.lastVisitedAt),
          and([
            eb('dum.last_visited_at', '=', cursor.lastVisitedAt),
            eb('d.id', '<', cursor.id),
          ]),
        ]),
      );
    }

    const rows = await query.execute();

    const documents: LibraryDocumentDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      access: row.access,
      lastVisitedAt: row.lastVisitedAt,
      lastEditedAt: row.lastEditedAt,
    }));

    // If we got a full page there may be more results — return the cursor
    // pointing at the last item. Otherwise signal end of results with null.
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
   * Searches documents the user has interacted with and has viewer+ access to,
   * matching by title using trigram similarity. Applies the same three-tier
   * access resolution and metadata row gate as getLibraryDocuments.
   * Empty-title documents are excluded.
   * @param userId - the authenticated user whose library to search
   * @param title - the search query to match against document titles
   * @param limit - maximum number of results to return
   * @returns matching documents ordered by similarity score descending
   */
  async searchLibraryDocuments(
    userId: number,
    title: string,
    limit: number,
  ): Promise<SearchLibraryDocumentsResponseDto> {
    const db = this.dbService.kysely;

    // Same join structure as getLibraryDocuments — metadata row as the
    // "has interacted" gate, document_access left-joined for the access check.
    // similarity() is provided by pg_trgm and scores how closely the title matches the query.
    const rows = await db
      .selectFrom('document_user_metadata as dum')
      .innerJoin('documents as d', 'd.id', 'dum.document_id')
      .leftJoin('document_access as da', (join) =>
        join
          .onRef('da.document_id', '=', 'dum.document_id')
          .on('da.user_id', '=', userId),
      )
      .select([
        'd.id',
        'd.title',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
        sql<ResolvedDocumentAccessLevel>`
          CASE
            WHEN d.owner_id = ${userId} THEN 'owner'
            WHEN da.access IS NOT NULL THEN da.access
            ELSE d.default_access
          END
        `.as('access'),
        sql<number>`similarity(d.title, ${title})`.as('score'),
      ])
      .where('dum.user_id', '=', userId)
      .where('d.is_deleted', '=', false)
      .where('d.title', '!=', '')
      .where(({ eb, or, and }) =>
        or([
          eb('d.owner_id', '=', userId),
          and([
            eb('da.user_id', 'is not', null),
            eb('da.access', '!=', 'noAccess'),
          ]),
          and([
            eb('da.user_id', 'is', null),
            eb('d.default_access', '!=', 'noAccess'),
          ]),
        ]),
      )
      .orderBy(sql`score`, 'desc')
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
