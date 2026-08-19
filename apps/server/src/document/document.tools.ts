import { Injectable } from '@nestjs/common';
import { DocumentService } from './document.service';
import {
  type ListDocumentsToolInputDto,
  type GetLibraryDocumentsResponseDto,
  type GetDocumentMetadataToolInputDto,
  type GetDocumentResponseDto,
} from '@converge/shared';

// MCP tool handlers for the document feature. Thin wrappers around
// DocumentService — access control is enforced entirely by the underlying
// calls (see getLibraryDocuments and getDocumentOfUser), same as their HTTP
// controller equivalents, so no separate authorization check is needed here.
@Injectable()
export class DocumentTools {
  constructor(private readonly documentService: DocumentService) {}

  /**
   * Lists documents in a workspace visible to the calling user, newest
   * last-visited first. Mirrors GET /document/library exactly.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - workspaceId plus optional pagination cursor
   */
  async listDocuments(
    userId: number,
    input: ListDocumentsToolInputDto,
  ): Promise<GetLibraryDocumentsResponseDto> {
    return this.documentService.getLibraryDocuments(
      userId,
      input.workspaceId,
      input.limit ?? 20,
      input.cursor,
    );
  }

  /**
   * Returns a document's metadata only (id, title, createdAt, workspace,
   * resolvedAccess) — no content. Content is exposed separately, by
   * getDocumentBlocks/getDocumentMarkdown, since it needs its own readable
   * conversion rather than the raw Yjs blob. getDocumentOfUser throws
   * NotFoundException/ForbiddenException on missing/inaccessible documents —
   * left uncaught here since the MCP SDK already converts a thrown error
   * into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document to fetch metadata for
   */
  async getDocumentMetadata(
    userId: number,
    input: GetDocumentMetadataToolInputDto,
  ): Promise<GetDocumentResponseDto> {
    return this.documentService.getDocumentOfUser(input.documentId, userId);
  }
}
