import { ForbiddenException, Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import { DocumentService } from './document.service.js';
import { DocumentAccessService } from './document-access.service.js';
import { DocumentYjsService } from './document-yjs.service.js';
import { markdownFromYjsUpdate } from './editor-schema.js';
import {
  type ListDocumentsToolInputDto,
  type GetLibraryDocumentsResponseDto,
  type GetDocumentMetadataToolInputDto,
  type GetDocumentResponseDto,
  type ReadDocumentMarkdownToolInputDto,
  type ReadDocumentMarkdownResponseDto,
  hasAccess,
} from '@converge/shared';

// MCP tool handlers for the document feature. Thin wrappers around
// DocumentService — access control is enforced entirely by the underlying
// calls (see getLibraryDocuments and getDocumentOfUser), same as their HTTP
// controller equivalents, so no separate authorization check is needed here.
@Injectable()
export class DocumentTools {
  constructor(
    private readonly documentService: DocumentService,
    private readonly documentAccessService: DocumentAccessService,
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
   * Returns a document's metadata only (id, title, createdAt, workspace,
   * resolvedAccess) — no content. Content is exposed separately, by
   * readDocumentMarkdown, since it needs its own readable conversion rather
   * than the raw Yjs blob. getDocumentOfUser throws
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

  /**
   * Reads a document's content as Markdown. Lossy: block ids, custom props,
   * and any structure Markdown can't express are dropped when converting
   * Blocks to Markdown — read-only, not meant to be diffed back into precise
   * block edits.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document to read
   */
  async readDocumentMarkdown(
    userId: number,
    input: ReadDocumentMarkdownToolInputDto,
  ): Promise<ReadDocumentMarkdownResponseDto> {
    // resolveAccess throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      input.documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    const yDoc = await this.documentYjsService.loadDoc(input.documentId);
    const markdown = await markdownFromYjsUpdate(Y.encodeStateAsUpdate(yDoc));

    return { markdown };
  }
}
