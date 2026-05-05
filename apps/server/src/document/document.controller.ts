import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { type Request } from 'express';
import { DocumentService } from './document.service';
import { httpOK } from '../utils/http-response.util';
import {
  type CreateDocumentResponseDto,
  type GetDocumentResponseDto,
  type GetDocumentOverviewResponseDto,
  type GetDocumentOwnerResponseDto,
  type TransferDocumentOwnerRequestDto,
  type TransferDocumentOwnerResponseDto,
  type FindNewDocumentAccessUserResponseDto,
  type SetDocumentAccessRequestDto,
  type GetLibraryDocumentsResponseDto,
  type SearchLibraryDocumentsResponseDto,
  type SearchDocumentAccessUsersResponseDto,
  type GetDocumentAccessResponseDto,
  type GetDocumentDefaultAccessResponseDto,
  type SetDocumentDefaultAccessRequestDto,
  type SetDocumentDefaultAccessResponseDto,
  GetLibraryDocumentsRequestSchema,
  SearchLibraryDocumentsRequestSchema,
  SearchDocumentAccessUsersRequestSchema,
  GetDocumentAccessRequestSchema,
  FindNewDocumentAccessUserRequestSchema,
  SetDocumentAccessRequestSchema,
  SetDocumentDefaultAccessRequestSchema,
  TransferDocumentOwnerRequestSchema,
} from '@converge/shared';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe';

@Controller('/document')
@UseGuards(AuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {} // Handles document CRUD — all routes require authentication via AuthGuard.

  /**
   * Returns the document with the given ID if it belongs to the authenticated user.
   * Throws 404 if the document does not exist, 403 if the user is not the owner.
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @param documentId - The document ID parsed from the URL path.
   * @returns The document's id, creatorId, and createdAt.
   */
  @Get('/id/:documentId')
  async handleGetDocument(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
  ): Promise<GetDocumentResponseDto> {
    const userId = (req as any).userId as number;
    const document = await this.documentService.getDocumentOfUser(
      documentId,
      userId,
    );
    return httpOK(document);
  }

  /**
   * Searches the authenticated user's documents by title using trigram similarity,
   * returning results ordered by relevance descending.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param query - title (non-empty, max 256 chars) and optional limit
   * @returns matching documents ordered by similarity score descending
   */
  @Get('/library/search')
  async handleSearchLibraryDocuments(
    @Req() req: Request,
    @Query(new ZodHttpValidationPipe(SearchLibraryDocumentsRequestSchema))
    query: { title: string; limit?: number },
  ): Promise<SearchLibraryDocumentsResponseDto> {
    const userId = (req as any).userId as number;
    const limit = query.limit ?? 20;
    return httpOK(
      await this.documentService.searchLibraryDocuments(
        userId,
        query.title,
        limit,
      ),
    );
  }

  /**
   * Returns a paginated list of the authenticated user's documents, ordered by
   * last_visited_at DESC. Uses keyset pagination — pass cursorVisitedAt and
   * cursorId from the previous response's nextCursor to fetch the next page.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param query - optional limit, cursorVisitedAt, and cursorId
   * @returns documents for this page and nextCursor (null on the last page)
   */
  @Get('/library')
  async handleGetLibraryDocuments(
    @Req() req: Request,
    @Query(new ZodHttpValidationPipe(GetLibraryDocumentsRequestSchema))
    query: { limit?: number; cursorVisitedAt?: Date; cursorId?: number },
  ): Promise<GetLibraryDocumentsResponseDto> {
    const userId = (req as any).userId as number;
    const limit = query.limit ?? 20;
    const cursor =
      query.cursorVisitedAt !== undefined && query.cursorId !== undefined
        ? { lastVisitedAt: query.cursorVisitedAt, id: query.cursorId }
        : undefined;
    return httpOK(
      await this.documentService.getLibraryDocuments(userId, limit, cursor),
    );
  }

  /**
   * Returns overview metadata for the given document: title, creator name and
   * email, creation date, and the most recent last-visited and last-edited
   * timestamps. Throws 404 if not found or deleted, 403 if not the owner.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @returns overview metadata for the document
   */
  @Get('/:id/overview')
  async handleGetDocumentOverview(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
  ): Promise<GetDocumentOverviewResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentService.getDocumentOverview(documentId, userId),
    );
  }

  /**
   * Soft-deletes the document with the given ID. Throws 404 if it does not
   * exist or is already deleted, and 403 if the user is not the owner.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   */
  @Delete('/:id')
  async handleDeleteDocument(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
  ): Promise<void> {
    const userId = (req as any).userId as number;
    await this.documentService.deleteDocument(documentId, userId);
  }

  /**
   * Returns the owner's basic profile (id, name, email, avatarUrl) for the
   * given document. Throws 404 if the document does not exist, 403 if the
   * requesting user is not the owner.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @returns the owner's id, name, email, and avatarUrl
   */
  @Get('/:documentId/owner')
  async handleGetDocumentOwner(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
  ): Promise<GetDocumentOwnerResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentService.getDocumentOwner(documentId, userId),
    );
  }

  /**
   * Transfers ownership of the given document to another user. The new owner's
   * existing access row is deleted and the old owner is upserted into
   * document_access with admin access. Throws 404 if the document or new owner
   * does not exist, 403 if the requester is not the owner, and 409 if the new
   * owner is already the current owner.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param body - the user ID of the incoming owner
   * @returns the new owner's id, name, email, and avatarUrl
   */
  @Put('/:documentId/owner')
  async handleTransferDocumentOwner(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body(new ZodHttpValidationPipe(TransferDocumentOwnerRequestSchema))
    body: TransferDocumentOwnerRequestDto,
  ): Promise<TransferDocumentOwnerResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentService.transferDocumentOwner(
        documentId,
        body.newOwnerId,
        userId,
      ),
    );
  }

  /**
   * Sets or updates the access level for a user on the given document. Creates
   * a new document_access row if none exists, otherwise updates the existing one.
   * Throws 404 if the document or target user is not found, 403 if the requester
   * is not the owner, and 409 if the target is the document owner.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param targetUserId - the user ID parsed from the URL path
   * @param body - the new access level to assign
   */
  @Put('/:documentId/access/:targetUserId')
  async handleSetDocumentAccess(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
    @Body(new ZodHttpValidationPipe(SetDocumentAccessRequestSchema))
    body: SetDocumentAccessRequestDto,
  ): Promise<void> {
    const userId = (req as any).userId as number;
    await this.documentService.setDocumentAccess(
      documentId,
      targetUserId,
      body.access,
      userId,
    );
  }

  /**
   * Deletes the access row for a user on the given document. Throws 404 if the
   * document or access row is not found, 403 if the requester is not the owner,
   * and 409 if the target is the document owner.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param targetUserId - the user ID parsed from the URL path
   */
  @Delete('/:documentId/access/:targetUserId')
  async handleDeleteDocumentAccess(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Param('targetUserId', ParseIntPipe) targetUserId: number,
  ): Promise<void> {
    const userId = (req as any).userId as number;
    await this.documentService.deleteDocumentAccess(
      documentId,
      targetUserId,
      userId,
    );
  }

  /**
   * Returns a paginated list of users with explicit access to the given document,
   * ordered by user_id ASC. Only the document owner can call this endpoint.
   * Throws 404 if the document does not exist, 403 if the user is not the owner.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param query - optional limit and cursorId for keyset pagination
   * @returns users for this page and nextCursor (null on the last page)
   */
  @Get('/:documentId/access')
  async handleGetDocumentAccess(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Query(new ZodHttpValidationPipe(GetDocumentAccessRequestSchema))
    query: { limit?: number; cursorId?: number },
  ): Promise<GetDocumentAccessResponseDto> {
    const userId = (req as any).userId as number;
    const limit = query.limit ?? 20;
    return httpOK(
      await this.documentService.getDocumentAccessUsers(
        documentId,
        userId,
        limit,
        query.cursorId,
      ),
    );
  }

  /**
   * Looks up a user by exact email who does not yet have access to the document.
   * Returns 404 if the document or user is not found, 403 if not the owner,
   * and 409 if the user is the document owner or already has an access row.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param query - exact email address to look up
   * @returns the matched user's id, name, email, and avatarUrl
   */
  @Get('/:documentId/access/find-new')
  async handleFindNewDocumentAccessUser(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Query(new ZodHttpValidationPipe(FindNewDocumentAccessUserRequestSchema))
    query: { email: string },
  ): Promise<FindNewDocumentAccessUserResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentService.findNewDocumentAccessUser(
        documentId,
        query.email,
        userId,
      ),
    );
  }

  /**
   * Returns the default access level for the given document. Only the document
   * owner can call this endpoint. Throws 404 if the document does not exist,
   * 403 if the user is not the owner.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @returns the document's current default access level
   */
  @Get('/access/default/:documentId')
  async handleGetDocumentDefaultAccess(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
  ): Promise<GetDocumentDefaultAccessResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentService.getDocumentDefaultAccess(documentId, userId),
    );
  }

  /**
   * Updates the default access level for the given document. Only the document
   * owner can call this endpoint. Throws 404 if the document does not exist,
   * 403 if the user is not the owner.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param body - the new default access level to assign
   * @returns the updated default access level
   */
  @Put('/access/default/:documentId')
  async handleSetDocumentDefaultAccess(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body(new ZodHttpValidationPipe(SetDocumentDefaultAccessRequestSchema))
    body: SetDocumentDefaultAccessRequestDto,
  ): Promise<SetDocumentDefaultAccessResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentService.setDocumentDefaultAccess(
        documentId,
        body.defaultAccess,
        userId,
      ),
    );
  }

  /**
   * Searches users who already have access to the given document by email using
   * trigram similarity. Only the document owner can call this endpoint.
   * Throws 404 if the document does not exist, 403 if the user is not the owner.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param query - email query string and optional limit
   * @returns matching users with their name, email, and access level
   */
  @Get('/:documentId/access/search')
  async handleSearchDocumentAccessUsers(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
    @Query(new ZodHttpValidationPipe(SearchDocumentAccessUsersRequestSchema))
    query: { email: string; limit?: number },
  ): Promise<SearchDocumentAccessUsersResponseDto> {
    const userId = (req as any).userId as number;
    const limit = query.limit ?? 20;
    return httpOK(
      await this.documentService.searchDocumentAccessUsers(
        documentId,
        query.email,
        limit,
        userId,
      ),
    );
  }

  /**
   * Creates a new document owned by the authenticated user and returns its ID.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @returns the new document's ID
   */
  @Post('/')
  async handleCreateDocument(
    @Req() req: Request,
  ): Promise<CreateDocumentResponseDto> {
    const userId = (req as any).userId as number;
    const documentId = await this.documentService.createNewDocument(userId);
    return httpOK({ documentId });
  }
}
