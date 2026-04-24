import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
  type GetLibraryDocumentsResponseDto,
  type SearchLibraryDocumentsResponseDto,
  GetLibraryDocumentsRequestSchema,
  SearchLibraryDocumentsRequestSchema,
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
