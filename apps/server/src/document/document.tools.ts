import { Injectable } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentYjsService } from './document-yjs.service';
import { uint8ArrayToBase64 } from '../utils/utils';
import {
  type ListDocumentsToolInputDto,
  type GetLibraryDocumentsResponseDto,
  type GetDocumentToolInputDto,
  type GetDocumentToolOutputDto,
} from '@converge/shared';

// MCP tool handlers for the document feature. Thin wrappers around
// DocumentService/DocumentYjsService — access control is enforced entirely
// by the underlying calls (see getLibraryDocuments and getDocumentOfUser),
// same as their HTTP controller equivalents, so no separate authorization
// check is needed here.
@Injectable()
export class DocumentTools {
  constructor(
    private readonly documentService: DocumentService,
    private readonly documentYjsService: DocumentYjsService,
  ) {}

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
   * Returns a document's metadata plus its full current content as one
   * base64-encoded, compacted Yjs update. getDocumentOfUser throws
   * NotFoundException/ForbiddenException on missing/inaccessible documents —
   * left uncaught here since the MCP SDK already converts a thrown error
   * into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document to fetch
   */
  async getDocument(
    userId: number,
    input: GetDocumentToolInputDto,
  ): Promise<GetDocumentToolOutputDto> {
    const doc = await this.documentService.getDocumentOfUser(
      input.documentId,
      userId,
    );
    const update = await this.documentYjsService.getYjsDocBlob(
      input.documentId,
    );

    return { ...doc, updateBase64: uint8ArrayToBase64(update) };
  }
}
