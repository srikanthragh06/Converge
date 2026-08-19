import { Injectable } from '@nestjs/common';
import { DocumentService } from './document.service.js';
import {
  type ListDocumentsToolInputDto,
  type ListDocumentsToolResponseDto,
  type GetDocumentMetadataToolInputDto,
  type GetDocumentMetadataToolResponseDto,
  type ReadDocumentMarkdownToolInputDto,
  type ReadDocumentMarkdownResponseDto,
  type GetDocumentBlocksToolInputDto,
  type GetDocumentBlocksResponseDto,
  type UpdateDocumentBlocksToolInputDto,
  type UpdateDocumentBlocksResponseDto,
} from '@converge/shared';

// MCP tool handlers for the document feature. Thin wrappers around
// DocumentService — access control is enforced entirely by the underlying
// calls (see getLibraryDocuments, getDocumentOfUser, and getDocumentMarkdown),
// same as their HTTP controller equivalents, so no separate authorization
// check is needed here.
@Injectable()
export class DocumentTools {
  constructor(private readonly documentService: DocumentService) {}

  /**
   * Lists documents in a workspace visible to the calling user, newest
   * last-visited first. Mirrors GET /document/library, except dates are
   * ISO strings rather than Date objects — MCP tool schemas can't represent
   * a Date type (see ListDocumentsToolResponseSchema).
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - workspaceId plus optional pagination cursor
   */
  async listDocuments(
    userId: number,
    input: ListDocumentsToolInputDto,
  ): Promise<ListDocumentsToolResponseDto> {
    const result = await this.documentService.getLibraryDocuments(
      userId,
      input.workspaceId,
      input.limit ?? 20,
      input.cursor
        ? {
            lastVisitedAt: input.cursor.lastVisitedAt
              ? new Date(input.cursor.lastVisitedAt)
              : null,
            id: input.cursor.id,
          }
        : undefined,
    );

    return {
      documents: result.documents.map((doc) => ({
        ...doc,
        lastVisitedAt: doc.lastVisitedAt?.toISOString() ?? null,
        lastEditedAt: doc.lastEditedAt?.toISOString() ?? null,
      })),
      nextCursor: result.nextCursor
        ? {
            ...result.nextCursor,
            lastVisitedAt: result.nextCursor.lastVisitedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  /**
   * Returns a document's metadata only (id, title, createdAt, workspace,
   * resolvedAccess) — no content. Content is exposed separately, by
   * readDocumentMarkdown, since it needs its own readable conversion rather
   * than the raw Yjs blob. createdAt is an ISO string rather than a Date
   * object — MCP tool schemas can't represent a Date type (see
   * GetDocumentMetadataToolResponseSchema). getDocumentOfUser throws
   * NotFoundException/ForbiddenException on missing/inaccessible documents —
   * left uncaught here since the MCP SDK already converts a thrown error
   * into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document to fetch metadata for
   */
  async getDocumentMetadata(
    userId: number,
    input: GetDocumentMetadataToolInputDto,
  ): Promise<GetDocumentMetadataToolResponseDto> {
    const result = await this.documentService.getDocumentOfUser(
      input.documentId,
      userId,
    );
    return { ...result, createdAt: result.createdAt.toISOString() };
  }

  /**
   * Reads a document's content as Markdown. getDocumentMarkdown throws
   * NotFoundException/ForbiddenException on missing/inaccessible documents —
   * left uncaught here since the MCP SDK already converts a thrown error
   * into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document to read
   */
  async readDocumentMarkdown(
    userId: number,
    input: ReadDocumentMarkdownToolInputDto,
  ): Promise<ReadDocumentMarkdownResponseDto> {
    const markdown = await this.documentService.getDocumentMarkdown(
      input.documentId,
      userId,
    );
    return { markdown };
  }

  /**
   * Reads a document's content as BlockNote block JSON, ids and all — the
   * read counterpart used to target block-level writes. getDocumentBlocks
   * throws NotFoundException/ForbiddenException on missing/inaccessible
   * documents — left uncaught here since the MCP SDK already converts a
   * thrown error into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document to read
   */
  async getDocumentBlocks(
    userId: number,
    input: GetDocumentBlocksToolInputDto,
  ): Promise<GetDocumentBlocksResponseDto> {
    const blocks = await this.documentService.getDocumentBlocks(
      input.documentId,
      userId,
    );
    return { blocks };
  }

  /**
   * Applies a batch of id-addressed block edits to a document as a single
   * atomic save, returning the document's resulting blocks. Use
   * getDocumentBlocks first to find the block ids to target. updateDocumentBlocks
   * throws NotFoundException/ForbiddenException on missing/inaccessible
   * documents — left uncaught here since the MCP SDK already converts a
   * thrown error into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document to edit and the edits to apply
   */
  async updateDocumentBlocks(
    userId: number,
    input: UpdateDocumentBlocksToolInputDto,
  ): Promise<UpdateDocumentBlocksResponseDto> {
    const blocks = await this.documentService.updateDocumentBlocks(
      input.documentId,
      userId,
      input.operations,
    );
    return { blocks };
  }
}
