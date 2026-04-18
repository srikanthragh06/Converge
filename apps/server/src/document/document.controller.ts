import { Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { type Request } from 'express';
import { DocumentService } from './document.service';
import { httpOK } from '../utils/http-response.util';
import { type CreateDocumentResponseDto, type GetDocumentResponseDto } from '@converge/shared';

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
  @Get('/:documentId')
  async handleGetDocument(
    @Req() req: Request,
    @Param('documentId', ParseIntPipe) documentId: number,
  ): Promise<GetDocumentResponseDto> {
    const userId = (req as any).userId as number;
    const document = await this.documentService.getDocumentOfUser(documentId, userId);
    return httpOK(document);
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
