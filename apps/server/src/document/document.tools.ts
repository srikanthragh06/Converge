import { Injectable } from '@nestjs/common';
import { DocumentService } from './document.service';
import {
  type ListDocumentsToolInputDto,
  type GetLibraryDocumentsResponseDto,
} from '@converge/shared';

// MCP tool handlers for the document feature. Thin wrappers around
// DocumentService — access control is enforced entirely by the underlying
// query (see getLibraryDocuments), same as the HTTP controller's equivalent
// route, so no separate authorization check is needed here.
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
}
