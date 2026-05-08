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
} from '@converge/shared';
import { DatabaseService } from '../db/database.service';
import { sql } from 'kysely';

@Injectable()
export class DocumentService {
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Returns the document with the given ID, throwing 404 if it does not exist
   * and 403 if the requesting user is not the owner.
   * @param documentId - the ID of the document to fetch
   * @param userId - the ID of the authenticated requesting user
   * @returns the document row
   */
  async getDocumentOfUser(
    documentId: number,
    userId: number,
  ): Promise<GetDocumentResponseDto> {
    const db = this.dbService.kysely;

    // Check existence first so we can return the correct error code.
    const row = await db
      .selectFrom('documents')
      .select(['id', 'title', 'owner_id', 'created_at'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Document not found.');
    if (row.owner_id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    return {
      id: row.id,
      title: row.title,
      ownerId: row.owner_id,
      createdAt: row.created_at,
    };
  }

  /**
   * Creates a new document and its initial metadata row in a single transaction,
   * returning the new document's ID.
   * @param userId - the ID of the authenticated user who will own the document
   * @returns the newly created document's ID
   */
  async createNewDocument(userId: number): Promise<number> {
    const db = this.dbService.kysely;

    // Wrap in a transaction so the document and its metadata row are always
    // created together — a document with no metadata row would break the
    // library query which treats last_visited_at and last_edited_at as non-nullable.
    const row = await db.transaction().execute(async (tx) => {
      const documentRow = await tx
        .insertInto('documents')
        .values({ creator_id: userId, owner_id: userId })
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
   * last-edited timestamps. Throws 404 if the document does not exist or is
   * deleted, and 403 if the requesting user is not the owner.
   * @param documentId - the document to fetch overview data for
   * @param userId - the authenticated user performing the request
   * @returns overview metadata for the document
   */
  async getDocumentOverview(
    documentId: number,
    userId: number,
  ): Promise<GetDocumentOverviewResponseDto> {
    const db = this.dbService.kysely;

    // Fetch the document row to verify existence and ownership.
    const docRow = await db
      .selectFrom('documents')
      .select(['title', 'owner_id', 'creator_id', 'created_at'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');
    if (docRow.owner_id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    const docUserRow = await db
      .selectFrom('document_user_metadata')
      .select([
        sql<Date>`max(last_visited_at)`.as('lastVisitedAt'),
        sql<Date>`max(last_edited_at)`.as('lastEditedAt'),
      ])
      .where('document_id', '=', documentId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!docUserRow)
      throw new NotFoundException('Document metadata not found.');

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

    return {
      title: docRow.title,
      creatorName: creatorRow.name,
      creatorEmail: creatorRow.email,
      ownerName: ownerRow.name,
      ownerEmail: ownerRow.email,
      createdAt: docRow.created_at,
      lastVisitedAt: docUserRow.lastVisitedAt,
      lastEditedAt: docUserRow.lastEditedAt,
    };
  }

  /**
   * Soft-deletes the document by setting is_deleted and deleted_at. Throws 404
   * if the document does not exist or is already deleted, and 403 if the
   * requesting user is not the owner.
   * @param documentId - the document to soft-delete
   * @param userId - the authenticated user performing the deletion
   */
  async deleteDocument(documentId: number, userId: number): Promise<void> {
    const db = this.dbService.kysely;

    // Verify existence and ownership before mutating.
    const row = await db
      .selectFrom('documents')
      .select(['owner_id'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Document not found.');
    if (row.owner_id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    // Mark the document as deleted without removing any rows.
    await db
      .updateTable('documents')
      .set({ is_deleted: true, deleted_at: new Date() })
      .where('id', '=', documentId)
      .execute();
  }

  /**
   * Returns a paginated list of documents owned by the given user, ordered by
   * last_visited_at DESC with id DESC as a tiebreaker. Uses keyset pagination
   * via a compound cursor (lastVisitedAt, id) so performance is consistent
   * regardless of page depth.
   * @param userId - the authenticated user whose documents to list
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

    // Build the base query — join users for ownerName and document_user_metadata for timestamps.
    let query = db
      .selectFrom('documents as d')
      .innerJoin('users as u', 'u.id', 'd.owner_id')
      .innerJoin('document_user_metadata as dum', 'dum.document_id', 'd.id')
      .select([
        'd.id',
        'd.title',
        'u.name as ownerName',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
      ])
      .where('d.owner_id', '=', userId)
      .where('d.is_deleted', '=', false)
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
      ownerName: row.ownerName,
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
   * Searches the authenticated user's documents by title using trigram similarity,
   * returning results ordered by relevance descending. Empty-title documents are
   * excluded.
   * @param userId - the authenticated user whose documents to search
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

    // similarity() is provided by pg_trgm and scores how closely the title matches the query.
    const rows = await db
      .selectFrom('documents as d')
      .innerJoin('users as u', 'u.id', 'd.owner_id')
      .innerJoin('document_user_metadata as dum', 'dum.document_id', 'd.id')
      .select([
        'd.id',
        'd.title',
        'u.name as ownerName',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
        sql<number>`similarity(d.title, ${title})`.as('score'),
      ])
      .where('d.owner_id', '=', userId)
      .where('d.is_deleted', '=', false)
      .where('d.title', '!=', '')
      .orderBy(sql`score`, 'desc')
      .limit(limit)
      .execute();

    const documents: LibraryDocumentDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      ownerName: row.ownerName,
      lastVisitedAt: row.lastVisitedAt,
      lastEditedAt: row.lastEditedAt,
    }));

    return { documents };
  }
}
