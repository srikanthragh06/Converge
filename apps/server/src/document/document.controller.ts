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
import { AuthGuard } from '../auth/auth.guard.js';
import { UserThrottlerGuard } from '../guards/user-throttler.guard.js';
import { type Request } from 'express';
import { DocumentService } from './document.service.js';
import { DocumentCheckpointService } from './document-checkpoint.service.js';
import { httpOK } from '../utils/http-response.util.js';
import {
  CreateDocumentRequestSchema,
  type CreateDocumentRequestDto,
  type CreateDocumentResponseDto,
  type CreateCheckpointResponseDto,
  type GetDocumentCheckpointsResponseDto,
  type GetDocumentCheckpointContentResponseDto,
  type GetDocumentResponseDto,
  type GetDocumentOverviewResponseDto,
  type GetLibraryDocumentsResponseDto,
  type GetPinnedDocumentsResponseDto,
  type SetDocumentPinnedRequestDto,
  type SetDocumentPinnedResponseDto,
  type SearchLibraryDocumentsResponseDto,
  type GetTrashDocumentsResponseDto,
  type GetUploadAuthResponseDto,
  GetDocumentCheckpointsRequestSchema,
  GetLibraryDocumentsRequestSchema,
  GetPinnedDocumentsRequestSchema,
  SetDocumentPinnedRequestSchema,
  SearchLibraryDocumentsRequestSchema,
  GetTrashDocumentsRequestSchema,
} from '@converge/shared';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe.js';

@Controller('/document')
@UseGuards(AuthGuard)
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly documentCheckpointService: DocumentCheckpointService,
  ) {} // Handles document CRUD, library, and version-history checkpoints — all routes require authentication via AuthGuard.

  /**
   * Returns the document with the given ID if it belongs to the authenticated user.
   * Throws 404 if the document does not exist, 403 if the user does not have access.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @returns the document's id, title, and createdAt
   */
  @Get('/id/:documentId')
  async handleGetDocument(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
  ): Promise<GetDocumentResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentService.getDocumentOfUser(documentId, userId),
    );
  }

  /**
   * Creates a new document in the given workspace. The user must have at least
   * the member role in that workspace.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param body - the workspace ID the document belongs to
   * @returns the new document's ID
   */
  @Post('/')
  async handleCreateDocument(
    @Req() req: Request,
    @Body(new ZodHttpValidationPipe(CreateDocumentRequestSchema))
    body: CreateDocumentRequestDto,
  ): Promise<CreateDocumentResponseDto> {
    const userId = (req as any).userId as number;
    const documentId = await this.documentService.createNewDocument(
      userId,
      body.workspaceId,
    );
    return httpOK({ documentId });
  }

  /**
   * Soft-deletes the document with the given ID. Throws 404 if it does not
   * exist or is already deleted, and 403 if the user does not have admin access.
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
   * Restores a soft-deleted document with the given ID. Throws 404 if it
   * does not exist at all, 403 if the user does not have admin access, and
   * 409 if the document is not currently deleted.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   */
  @Post('/:id/restore')
  async handleRestoreDocument(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
  ): Promise<void> {
    const userId = (req as any).userId as number;
    await this.documentService.restoreDocument(documentId, userId);
  }

  /**
   * Returns a paginated list of soft-deleted documents in the given
   * workspace the user has admin+ access to, ordered by deleted_at DESC.
   * Uses keyset pagination — pass cursorDeletedAt and cursorId from the
   * previous response's nextCursor to fetch the next page.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param query - workspaceId, optional limit, cursorDeletedAt, and cursorId
   * @returns trashed documents for this page and nextCursor (null on the last page)
   */
  @Get('/trash')
  async handleGetTrashDocuments(
    @Req() req: Request,
    @Query(new ZodHttpValidationPipe(GetTrashDocumentsRequestSchema))
    query: {
      workspaceId: number;
      limit?: number;
      cursorDeletedAt?: Date;
      cursorId?: number;
    },
  ): Promise<GetTrashDocumentsResponseDto> {
    const userId = (req as any).userId as number;
    const limit = query.limit ?? 20;
    const cursor =
      query.cursorDeletedAt !== undefined && query.cursorId !== undefined
        ? { deletedAt: query.cursorDeletedAt, id: query.cursorId }
        : undefined;
    return httpOK(
      await this.documentService.getTrashDocuments(
        userId,
        query.workspaceId,
        limit,
        cursor,
      ),
    );
  }

  /**
   * Returns overview metadata for the given document: title, creator and
   * owner name and email, creation date, and RAG indexing status (lifecycle
   * state plus when it was last confirmed indexed). Throws 404 if not found
   * or deleted, 403 if the user does not have access.
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
   * Searches the authenticated user's documents by title using trigram similarity,
   * returning results ordered by relevance descending.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param query - workspaceId, title (non-empty, max 256 chars), and optional limit
   * @returns matching documents ordered by similarity score descending
   */
  @Get('/library/search')
  async handleSearchLibraryDocuments(
    @Req() req: Request,
    @Query(new ZodHttpValidationPipe(SearchLibraryDocumentsRequestSchema))
    query: { workspaceId: number; title: string; limit?: number },
  ): Promise<SearchLibraryDocumentsResponseDto> {
    const userId = (req as any).userId as number;
    const limit = query.limit ?? 20;
    return httpOK(
      await this.documentService.searchLibraryDocuments(
        userId,
        query.workspaceId,
        query.title,
        limit,
      ),
    );
  }

  /**
   * Returns a paginated list of documents in the given workspace the user has
   * viewer+ access to, ordered by last_visited_at DESC. Uses keyset pagination
   * — pass cursorVisitedAt and cursorId from the previous response's nextCursor
   * to fetch the next page.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param query - workspaceId, optional limit, cursorVisitedAt, cursorId, and ignorePinnedDocs
   * @returns documents for this page and nextCursor (null on the last page)
   */
  @Get('/library')
  async handleGetLibraryDocuments(
    @Req() req: Request,
    @Query(new ZodHttpValidationPipe(GetLibraryDocumentsRequestSchema))
    query: {
      workspaceId: number;
      limit?: number;
      cursorVisitedAt?: Date;
      cursorId?: number;
      ignorePinnedDocs?: boolean;
    },
  ): Promise<GetLibraryDocumentsResponseDto> {
    const userId = (req as any).userId as number;
    const limit = query.limit ?? 20;
    const cursor =
      query.cursorVisitedAt !== undefined && query.cursorId !== undefined
        ? { lastVisitedAt: query.cursorVisitedAt, id: query.cursorId }
        : undefined;
    return httpOK(
      await this.documentService.getLibraryDocuments(
        userId,
        query.workspaceId,
        limit,
        cursor,
        query.ignorePinnedDocs ?? false,
      ),
    );
  }

  /**
   * Returns every document in the given workspace the user has pinned and
   * still has viewer+ access to, ordered by most recently pinned first.
   * Unpaginated.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param query - workspaceId
   * @returns the user's pinned documents in this workspace
   */
  @Get('/pinned')
  async handleGetPinnedDocuments(
    @Req() req: Request,
    @Query(new ZodHttpValidationPipe(GetPinnedDocumentsRequestSchema))
    query: { workspaceId: number },
  ): Promise<GetPinnedDocumentsResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentService.getPinnedDocuments(userId, query.workspaceId),
    );
  }

  /**
   * Pins or unpins the given document for the requesting user. Throws 404 if
   * the document does not exist or is deleted, 403 if the user has less than
   * viewer access.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param body - pinned: true to pin, false to unpin
   * @returns the resulting pinnedAt value — a timestamp when pinned, null when unpinned
   */
  @Put('/:id/pin')
  async handleSetDocumentPinned(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
    @Body(new ZodHttpValidationPipe(SetDocumentPinnedRequestSchema))
    body: SetDocumentPinnedRequestDto,
  ): Promise<SetDocumentPinnedResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentService.setPinned(documentId, userId, body.pinned),
    );
  }

  /**
   * Takes a manual version-history checkpoint for the given document.
   * Throws 403 if the user does not have editor+ access.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @returns whether a checkpoint was created, its id if so, and a message
   * explaining the outcome either way
   */
  @Post('/:id/checkpoint')
  async handleCreateCheckpoint(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
  ): Promise<CreateCheckpointResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentCheckpointService.createCheckpoint(documentId, userId),
    );
  }

  /**
   * Returns a keyset-paginated list of version-history checkpoints for the
   * document, newest first, each with its contributors. Throws 403 if the
   * user does not have viewer+ access.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param query - optional limit (default 20) and cursorId for pagination
   * @returns checkpoints for this page and nextCursor (null on the last page)
   */
  @Get('/:id/checkpoints')
  async handleGetDocumentCheckpoints(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
    @Query(new ZodHttpValidationPipe(GetDocumentCheckpointsRequestSchema))
    query: { limit?: number; cursorId?: number },
  ): Promise<GetDocumentCheckpointsResponseDto> {
    const userId = (req as any).userId as number;
    const limit = query.limit ?? 20;
    return httpOK(
      await this.documentCheckpointService.listCheckpoints(
        documentId,
        userId,
        limit,
        query.cursorId,
      ),
    );
  }

  /**
   * Returns a checkpoint's metadata (id, createdAt, contributors, source)
   * plus its full reconstructed content as a base64-encoded Yjs update.
   * Throws 403 if the user does not have viewer+ access, 404 if
   * checkpointId is not a checkpoint on this document.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param documentId - the document ID parsed from the URL path
   * @param checkpointId - the checkpoint ID parsed from the URL path
   * @returns the checkpoint's metadata and content as a base64-encoded Yjs update
   */
  @Get('/:id/checkpoints/:checkpointId')
  async handleGetDocumentCheckpointContent(
    @Req() req: Request,
    @Param('id', ParseIntPipe) documentId: number,
    @Param('checkpointId', ParseIntPipe) checkpointId: number,
  ): Promise<GetDocumentCheckpointContentResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.documentCheckpointService.getCheckpointContent(
        documentId,
        userId,
        checkpointId,
      ),
    );
  }

  /**
   * Returns a one-time ImageKit upload auth token for the authenticated user.
   * Rate-limited to 10 requests per minute per user — each token mints a valid
   * ImageKit upload credential, so uncapped calls could fill storage with junk.
   * @returns token, expire, and HMAC-SHA1 signature for a client-side ImageKit upload
   */
  @UseGuards(UserThrottlerGuard)
  @Get('/upload-auth')
  handleGetUploadAuth(): GetUploadAuthResponseDto {
    return httpOK(this.documentService.getImageKitUploadAuth());
  }
}
