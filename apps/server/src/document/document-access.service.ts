import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GetDocumentOwnerResponseDto,
  FindNewDocumentAccessUserResponseDto,
  SetDocumentAccessRequestDto,
  SearchDocumentAccessUsersResponseDto,
  GetDocumentAccessResponseDto,
  GetDocumentDefaultAccessResponseDto,
  SetDocumentDefaultAccessResponseDto,
  TransferDocumentOwnerResponseDto,
  FindNewDocumentOwnerResponseDto,
  DocumentAccessLevel,
  type ResolvedDocumentAccessLevel,
  ACCESS_RANK,
} from '@converge/shared';
import { DatabaseService } from '../db/database.service';
import { sql } from 'kysely';

@Injectable()
export class DocumentAccessService {
  constructor(private readonly dbService: DatabaseService) {}

  /**
   * Resolves the effective access level for a user on a document by checking
   * ownership first, then an explicit document_access row, then falling back to
   * the document's default_access. Throws NotFoundException if the document does
   * not exist or is deleted — callers should handle this exception appropriately
   * for their context (HTTP 404, socket disconnect, etc.).
   * @param documentId - the document to resolve access for
   * @param userId - the user whose access level to resolve
   * @returns the resolved access level: 'owner', an explicit level, or default_access
   */
  async resolveAccess(
    documentId: number,
    userId: number,
  ): Promise<ResolvedDocumentAccessLevel> {
    const db = this.dbService.kysely;

    // Fetch ownership and default_access in one query.
    const docRow = await db
      .selectFrom('documents')
      .select(['owner_id', 'default_access'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');

    // Owners have full implicit access — no access row is stored for them.
    if (docRow.owner_id === userId) return 'owner';

    // Check for an explicit access row for this user.
    const accessRow = await db
      .selectFrom('document_access')
      .select(['access'])
      .where('document_id', '=', documentId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (accessRow) return accessRow.access as DocumentAccessLevel;

    // Fall back to the document-wide default.
    return docRow.default_access as DocumentAccessLevel;
  }

  /**
   * Returns true if the resolved access level meets or exceeds the required
   * level using the numeric ACCESS_RANK ordering.
   * @param resolved - the user's resolved access level from resolveAccess
   * @param required - the minimum level needed for the operation
   */
  hasAccess(
    resolved: ResolvedDocumentAccessLevel,
    required: ResolvedDocumentAccessLevel,
  ): boolean {
    return ACCESS_RANK[resolved] >= ACCESS_RANK[required];
  }

  /**
   * Returns the owner's basic profile for the given document. Throws 404 if
   * the document does not exist or is deleted, and 403 if the requesting user
   * is not the owner.
   * @param documentId - the document whose owner to fetch
   * @param userId - the authenticated user performing the request
   * @returns the owner's id, name, email, and avatarUrl
   */
  async getDocumentOwner(
    documentId: number,
    userId: number,
  ): Promise<GetDocumentOwnerResponseDto> {
    const db = this.dbService.kysely;

    // Verify existence and ownership, then fetch the owner's profile in one join.
    const row = await db
      .selectFrom('documents as d')
      .innerJoin('users as u', 'u.id', 'd.owner_id')
      .select(['u.id', 'u.name', 'u.email', 'u.avatar_url'])
      .where('d.id', '=', documentId)
      .where('d.is_deleted', '=', false)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Document not found.');
    if (row.id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatar_url,
    };
  }

  /**
   * Looks up a user by exact email and checks they do not already have access
   * to the given document. Throws 404 if the document does not exist or the
   * user is not found, 403 if the requester is not the owner, and 409 if the
   * user is the document owner or already has an access row for this document.
   * @param documentId - the document to check access against
   * @param email - exact email address to look up
   * @param userId - the authenticated user performing the request
   * @returns the matched user's id, name, email, and avatarUrl
   */
  async findNewDocumentAccessUser(
    documentId: number,
    email: string,
    userId: number,
  ): Promise<FindNewDocumentAccessUserResponseDto> {
    const db = this.dbService.kysely;

    // Verify the document exists and the requester is the owner.
    const docRow = await db
      .selectFrom('documents')
      .select(['owner_id'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');
    if (docRow.owner_id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    // Look up the user by exact email.
    const userRow = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'avatar_url'])
      .where('email', '=', email)
      .executeTakeFirst();

    if (!userRow) throw new NotFoundException('User not found.');

    // Reject if the looked-up user is the document owner.
    if (userRow.id === docRow.owner_id)
      throw new ConflictException('User is the document owner.');

    // Reject if the user already has an access row for this document.
    const accessRow = await db
      .selectFrom('document_access')
      .select(['user_id'])
      .where('document_id', '=', documentId)
      .where('user_id', '=', userRow.id)
      .executeTakeFirst();

    if (accessRow) throw new ConflictException('User already has access.');

    return {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      avatarUrl: userRow.avatar_url,
    };
  }

  /**
   * Upserts the access level for a user on a document. Throws 404 if the
   * document or target user does not exist, 403 if the requester is not the
   * owner, and 409 if the target user is the owner.
   * @param documentId - the document to set access on
   * @param targetUserId - the user whose access level is being set
   * @param access - the new access level to assign
   * @param requestingUserId - the authenticated user performing the request
   */
  async setDocumentAccess(
    documentId: number,
    targetUserId: number,
    access: SetDocumentAccessRequestDto['access'],
    requestingUserId: number,
  ): Promise<void> {
    const db = this.dbService.kysely;

    // Verify the document exists and the requester is the owner.
    const docRow = await db
      .selectFrom('documents')
      .select(['owner_id'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');
    if (docRow.owner_id !== requestingUserId)
      throw new ForbiddenException('You do not have access to this document.');

    // Prevent assigning explicit access to the owner — ownership is tracked
    // via documents.owner_id, not via document_access rows.
    if (targetUserId === docRow.owner_id)
      throw new ConflictException('Cannot set access for the document owner.');

    // Verify the target user exists.
    const userRow = await db
      .selectFrom('users')
      .select(['id'])
      .where('id', '=', targetUserId)
      .executeTakeFirst();

    if (!userRow) throw new NotFoundException('User not found.');

    // Upsert the access row — insert on first assignment, update on change.
    await db
      .insertInto('document_access')
      .values({ document_id: documentId, user_id: targetUserId, access })
      .onConflict((oc) =>
        oc.columns(['document_id', 'user_id']).doUpdateSet({ access }),
      )
      .execute();
  }

  /**
   * Deletes the access row for a user on a document. Throws 404 if the document
   * or access row does not exist, 403 if the requester is not the owner, and
   * 409 if the target user is the document owner.
   * @param documentId - the document to remove access from
   * @param targetUserId - the user whose access row to delete
   * @param requestingUserId - the authenticated user performing the request
   */
  async deleteDocumentAccess(
    documentId: number,
    targetUserId: number,
    requestingUserId: number,
  ): Promise<void> {
    const db = this.dbService.kysely;

    // Verify the document exists and the requester is the owner.
    const docRow = await db
      .selectFrom('documents')
      .select(['owner_id'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');
    if (docRow.owner_id !== requestingUserId)
      throw new ForbiddenException('You do not have access to this document.');

    // The owner has no access row — reject early rather than silently no-op.
    if (targetUserId === docRow.owner_id)
      throw new ConflictException(
        'Cannot remove access for the document owner.',
      );

    // Delete the row and confirm it existed.
    const result = await db
      .deleteFrom('document_access')
      .where('document_id', '=', documentId)
      .where('user_id', '=', targetUserId)
      .executeTakeFirst();

    if (!result.numDeletedRows)
      throw new NotFoundException('Access row not found.');
  }

  /**
   * Searches users who already have access to the given document using trigram
   * similarity on their email address. Throws 404 if the document does not
   * exist or is deleted, and 403 if the requesting user is not the owner.
   * @param documentId - the document whose access list to search
   * @param email - the email query to match against
   * @param limit - maximum number of results to return
   * @param userId - the authenticated user performing the request
   * @returns matching users with their name, email, and access level
   */
  async searchDocumentAccessUsers(
    documentId: number,
    email: string,
    limit: number,
    userId: number,
  ): Promise<SearchDocumentAccessUsersResponseDto> {
    const db = this.dbService.kysely;

    // Verify existence and ownership before exposing the access list.
    const docRow = await db
      .selectFrom('documents')
      .select(['owner_id'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');
    if (docRow.owner_id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    // Search the access rows for this document using trigram similarity on email.
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
      .orderBy(sql`score`, 'desc')
      .limit(limit)
      .execute();

    return {
      users: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
        access: row.access as DocumentAccessLevel,
      })),
    };
  }

  /**
   * Returns a paginated list of users who have explicit access to the given
   * document, ordered by user_id ASC. Uses keyset pagination via cursorId.
   * Throws 404 if the document does not exist or is deleted, and 403 if the
   * requesting user is not the owner.
   * @param documentId - the document whose access list to fetch
   * @param userId - the authenticated user performing the request
   * @param limit - maximum number of results to return
   * @param cursorId - user_id of the last item from the previous page; omit for the first page
   * @returns users for this page and nextCursor to fetch the following page
   */
  async getDocumentAccessUsers(
    documentId: number,
    userId: number,
    limit: number,
    cursorId?: number,
  ): Promise<GetDocumentAccessResponseDto> {
    const db = this.dbService.kysely;

    // Verify existence and ownership before exposing the access list.
    const docRow = await db
      .selectFrom('documents')
      .select(['owner_id'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');
    if (docRow.owner_id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    // Build the base query — join users for display fields, order by user_id for stable pagination.
    let query = db
      .selectFrom('document_access as da')
      .innerJoin('users as u', 'u.id', 'da.user_id')
      .select(['u.id', 'u.name', 'u.email', 'u.avatar_url', 'da.access'])
      .where('da.document_id', '=', documentId)
      .orderBy('da.user_id', 'asc')
      .limit(limit);

    // Apply the keyset cursor to fetch only rows after the last seen user_id.
    if (cursorId !== undefined) {
      query = query.where('da.user_id', '>', cursorId);
    }

    const rows = await query.execute();

    // If we got a full page there may be more — return the last user_id as the cursor.
    const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

    return {
      users: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
        access: row.access as DocumentAccessLevel,
      })),
      nextCursor,
    };
  }

  /**
   * Looks up a user by exact email to be assigned as the new document owner.
   * Throws 404 if the document or user does not exist, 403 if the requester is
   * not the owner, and 409 if the matched user is already the document owner.
   * @param documentId - the document whose ownership is being transferred
   * @param email - exact email address to look up
   * @param userId - the authenticated user performing the request
   * @returns the matched user's id, name, email, and avatarUrl
   */
  async findNewDocumentOwner(
    documentId: number,
    email: string,
    userId: number,
  ): Promise<FindNewDocumentOwnerResponseDto> {
    const db = this.dbService.kysely;

    // Verify the document exists and the requester is the current owner.
    const docRow = await db
      .selectFrom('documents')
      .select(['owner_id'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');
    if (docRow.owner_id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    // Look up the candidate by exact email.
    const userRow = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'avatar_url'])
      .where('email', '=', email)
      .executeTakeFirst();

    if (!userRow) throw new NotFoundException('User not found.');

    // Reject if the candidate is already the document owner.
    if (userRow.id === docRow.owner_id)
      throw new ConflictException('User is already the document owner.');

    return {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      avatarUrl: userRow.avatar_url,
    };
  }

  /**
   * Transfers document ownership to another user in a single transaction.
   * The new owner's existing access row (if any) is deleted since owners are
   * not stored in document_access. The old owner is upserted into document_access
   * with admin-level access so they retain editing rights after the transfer.
   * Throws 404 if the document or new owner user does not exist, 403 if the
   * requester is not the current owner, and 409 if the new owner is already
   * the current owner.
   * @param documentId - the document to transfer ownership of
   * @param newOwnerId - the user ID of the incoming owner
   * @param requestingUserId - the authenticated user performing the request
   * @returns the new owner's id, name, email, and avatarUrl
   */
  async transferDocumentOwner(
    documentId: number,
    newOwnerId: number,
    requestingUserId: number,
  ): Promise<TransferDocumentOwnerResponseDto> {
    const db = this.dbService.kysely;

    // Verify the document exists and the requester is the current owner.
    const docRow = await db
      .selectFrom('documents')
      .select(['owner_id'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');
    if (docRow.owner_id !== requestingUserId)
      throw new ForbiddenException('You do not have access to this document.');

    // Prevent a no-op transfer to the current owner.
    if (newOwnerId === docRow.owner_id)
      throw new ConflictException('User is already the document owner.');

    // Verify the new owner exists and fetch their profile for the response.
    const newOwnerRow = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'avatar_url'])
      .where('id', '=', newOwnerId)
      .executeTakeFirst();

    if (!newOwnerRow) throw new NotFoundException('User not found.');

    // Perform the transfer atomically:
    // 1. Update owner_id on the document.
    // 2. Delete any existing access row for the new owner (owners have no access row).
    // 3. Upsert the old owner into document_access with admin so they retain editing rights.
    await db.transaction().execute(async (tx) => {
      await tx
        .updateTable('documents')
        .set({ owner_id: newOwnerId })
        .where('id', '=', documentId)
        .execute();

      await tx
        .deleteFrom('document_access')
        .where('document_id', '=', documentId)
        .where('user_id', '=', newOwnerId)
        .execute();

      await tx
        .insertInto('document_access')
        .values({
          document_id: documentId,
          user_id: requestingUserId,
          access: 'admin',
        })
        .onConflict((oc) =>
          oc
            .columns(['document_id', 'user_id'])
            .doUpdateSet({ access: 'admin' }),
        )
        .execute();
    });

    return {
      id: newOwnerRow.id,
      name: newOwnerRow.name,
      email: newOwnerRow.email,
      avatarUrl: newOwnerRow.avatar_url,
    };
  }

  /**
   * Returns the default access level for the given document. Throws 404 if the
   * document does not exist or is deleted, and 403 if the requesting user is not
   * the owner.
   * @param documentId - the document to fetch the default access for
   * @param userId - the authenticated user performing the request
   * @returns the document's current default access level
   */
  async getDocumentDefaultAccess(
    documentId: number,
    userId: number,
  ): Promise<GetDocumentDefaultAccessResponseDto> {
    const db = this.dbService.kysely;

    // Verify existence and ownership, then return the current default.
    const row = await db
      .selectFrom('documents')
      .select(['owner_id', 'default_access'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Document not found.');
    if (row.owner_id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    return { defaultAccess: row.default_access };
  }

  /**
   * Updates the default access level for the given document. Throws 404 if the
   * document does not exist or is deleted, and 403 if the requesting user is not
   * the owner.
   * @param documentId - the document to update the default access for
   * @param defaultAccess - the new fallback access level to assign
   * @param userId - the authenticated user performing the request
   * @returns the updated default access level
   */
  async setDocumentDefaultAccess(
    documentId: number,
    defaultAccess: DocumentAccessLevel,
    userId: number,
  ): Promise<SetDocumentDefaultAccessResponseDto> {
    const db = this.dbService.kysely;

    // Verify existence and ownership before mutating.
    const docRow = await db
      .selectFrom('documents')
      .select(['owner_id'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');
    if (docRow.owner_id !== userId)
      throw new ForbiddenException('You do not have access to this document.');

    // Persist the new default access level.
    await db
      .updateTable('documents')
      .set({ default_access: defaultAccess })
      .where('id', '=', documentId)
      .execute();

    return { defaultAccess };
  }
}
