import { Injectable } from '@nestjs/common';
import { DocumentService } from './document.service.js';
import { DocumentCheckpointService } from './document-checkpoint.service.js';
import {
  type ListDocumentsToolInputDto,
  type ListDocumentsToolResponseDto,
  type SearchDocumentsToolInputDto,
  type SearchDocumentsToolResponseDto,
  type GetDocumentMetadataToolInputDto,
  type GetDocumentMetadataToolResponseDto,
  type ReadDocumentMarkdownToolInputDto,
  type ReadDocumentMarkdownResponseDto,
  type GetDocumentBlocksToolInputDto,
  type GetDocumentBlocksResponseDto,
  type UpdateDocumentBlocksToolInputDto,
  type UpdateDocumentBlocksResponseDto,
  type CreateDocumentToolInputDto,
  type CreateDocumentResponseDto,
  type UpdateDocumentTitleToolInputDto,
  type UpdateDocumentTitleResponseDto,
  type DeleteDocumentToolInputDto,
  type DeleteDocumentResponseDto,
  type ListCheckpointsToolInputDto,
  type ListCheckpointsToolResponseDto,
} from '@converge/shared';

// MCP tool handlers for the document feature. Thin wrappers around
// DocumentService/DocumentCheckpointService — access control is enforced
// entirely by the underlying calls (see getLibraryDocuments,
// getDocumentOfUser, getDocumentMarkdown, and listCheckpoints), same as
// their HTTP controller equivalents, so no separate authorization check is
// needed here.
@Injectable()
export class DocumentTools {
  constructor(
    private readonly documentService: DocumentService,
    private readonly documentCheckpointService: DocumentCheckpointService,
  ) {}

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
   * Searches documents in a workspace visible to the calling user by title,
   * ordered by relevance. Mirrors GET /document/library/search, except dates
   * are ISO strings rather than Date objects — MCP tool schemas can't
   * represent a Date type (see SearchDocumentsToolResponseSchema).
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the workspace to search in, the title query, and an
   * optional result limit
   */
  async searchDocuments(
    userId: number,
    input: SearchDocumentsToolInputDto,
  ): Promise<SearchDocumentsToolResponseDto> {
    const result = await this.documentService.searchLibraryDocuments(
      userId,
      input.workspaceId,
      input.title,
      input.limit ?? 20,
    );

    return {
      documents: result.documents.map((doc) => ({
        ...doc,
        lastVisitedAt: doc.lastVisitedAt?.toISOString() ?? null,
        lastEditedAt: doc.lastEditedAt?.toISOString() ?? null,
      })),
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

  /**
   * Creates a new, empty document in a workspace and returns its id.
   * createNewDocument throws ForbiddenException if the caller is not at
   * least a member of the workspace — left uncaught here since the MCP SDK
   * already converts a thrown error into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the workspace to create the document in, plus an
   * optional initial title (already trimmed and length-checked by
   * CreateDocumentToolInputSchema)
   */
  async createDocument(
    userId: number,
    input: CreateDocumentToolInputDto,
  ): Promise<CreateDocumentResponseDto> {
    const documentId = await this.documentService.createNewDocument(
      userId,
      input.workspaceId,
      input.title,
    );
    return { documentId };
  }

  /**
   * Renames a document. updateDocumentTitle throws
   * NotFoundException/ForbiddenException on missing/inaccessible documents —
   * left uncaught here since the MCP SDK already converts a thrown error
   * into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document to rename and its new title (already
   * trimmed and length-checked by UpdateDocumentTitleToolInputSchema)
   */
  async updateDocumentTitle(
    userId: number,
    input: UpdateDocumentTitleToolInputDto,
  ): Promise<UpdateDocumentTitleResponseDto> {
    const title = await this.documentService.updateDocumentTitle(
      input.documentId,
      userId,
      input.title,
    );
    return { title };
  }

  /**
   * Soft-deletes a document. deleteDocument throws
   * NotFoundException/ForbiddenException on missing/inaccessible documents —
   * left uncaught here since the MCP SDK already converts a thrown error
   * into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document to delete
   */
  async deleteDocument(
    userId: number,
    input: DeleteDocumentToolInputDto,
  ): Promise<DeleteDocumentResponseDto> {
    await this.documentService.deleteDocument(input.documentId, userId);
    return { success: true };
  }

  /**
   * Lists a document's version-history checkpoints, newest first, each with
   * its contributors. Mirrors GET /document/:id/checkpoints, except dates
   * are ISO strings rather than Date objects — MCP tool schemas can't
   * represent a Date type (see ListCheckpointsToolResponseSchema).
   * listCheckpoints throws ForbiddenException if the caller lacks viewer+
   * access — left uncaught here since the MCP SDK already converts a thrown
   * error into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document to list checkpoints for, plus an optional
   * limit and pagination cursor
   */
  async listCheckpoints(
    userId: number,
    input: ListCheckpointsToolInputDto,
  ): Promise<ListCheckpointsToolResponseDto> {
    const result = await this.documentCheckpointService.listCheckpoints(
      input.documentId,
      userId,
      input.limit ?? 20,
      input.cursorId,
    );

    return {
      checkpoints: result.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        createdAt: checkpoint.createdAt.toISOString(),
        lastEditedAt: checkpoint.lastEditedAt.toISOString(),
      })),
      nextCursor: result.nextCursor,
    };
  }
}
