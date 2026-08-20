import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import { DocumentService } from './document.service.js';
import { DocumentCheckpointService } from './document-checkpoint.service.js';
import { blocksFromYDoc } from '../utils/editor-schema.js';
import { base64ToUint8Array } from '../utils/utils.js';
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
  type GetCheckpointContentToolInputDto,
  type GetCheckpointContentToolResponseDto,
  type RestoreCheckpointToolInputDto,
  type RestoreCheckpointResponseDto,
  type ListDeletedDocumentsToolInputDto,
  type ListDeletedDocumentsToolResponseDto,
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

  /**
   * Reads a checkpoint's full content as BlockNote blocks, alongside its
   * metadata. getCheckpointContent throws ForbiddenException/NotFoundException
   * on insufficient access / an unknown checkpoint — left uncaught here since
   * the MCP SDK already converts a thrown error into a proper isError tool
   * result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document and checkpoint to read
   */
  async getCheckpointContent(
    userId: number,
    input: GetCheckpointContentToolInputDto,
  ): Promise<GetCheckpointContentToolResponseDto> {
    const checkpoint = await this.documentCheckpointService.getCheckpointContent(
      input.documentId,
      userId,
      input.checkpointId,
    );

    // A checkpoint's updateBase64 is a full self-contained Yjs state (every
    // checkpoint row from the beginning merged up through this one), not a
    // delta — so applying it to a fresh scratch doc fully reconstructs the
    // document's content at that point in time. No withMutex/jsdom needed:
    // blocksFromYDoc is a pure Yjs-tree walk (see editor-schema.ts).
    const scratch = new Y.Doc();
    Y.applyUpdate(scratch, base64ToUint8Array(checkpoint.updateBase64));
    const blocks = blocksFromYDoc(scratch);

    return {
      id: checkpoint.id,
      createdAt: checkpoint.createdAt.toISOString(),
      lastEditedAt: checkpoint.lastEditedAt.toISOString(),
      contributors: checkpoint.contributors,
      source: checkpoint.source,
      blocks,
    };
  }

  /**
   * Restores a document's content to a past checkpoint. Only restores
   * blocks, not title (see DocumentService.restoreCheckpoint). Takes a
   * fresh 'mcp' checkpoint immediately before the restore lands, same as
   * updateDocumentBlocks, so an unwanted restore is itself just one more
   * restore away from undo. restoreCheckpoint throws
   * NotFoundException/ForbiddenException on insufficient access / an
   * unknown checkpoint — left uncaught here since the MCP SDK already
   * converts a thrown error into a proper isError tool result.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - the document and checkpoint to restore to
   */
  async restoreCheckpoint(
    userId: number,
    input: RestoreCheckpointToolInputDto,
  ): Promise<RestoreCheckpointResponseDto> {
    const blocks = await this.documentService.restoreCheckpoint(
      input.documentId,
      userId,
      input.checkpointId,
    );
    return { blocks };
  }

  /**
   * Lists soft-deleted documents in a workspace, newest-deleted first.
   * Mirrors GET /document/trash, except dates are ISO strings rather than
   * Date objects — MCP tool schemas can't represent a Date type (see
   * ListDeletedDocumentsToolResponseSchema). getTrashDocuments scopes
   * results to admin+ access at the query level itself — a caller without
   * admin+ access just sees an empty list rather than a thrown error, since
   * admin+ is also what's required to restore a document (see
   * restoreDocument), same as its HTTP controller equivalent — so no
   * separate authorization check is needed here.
   * @param userId - the calling user's ID, resolved from their API key
   * @param input - workspaceId plus optional limit and pagination cursor
   */
  async listDeletedDocuments(
    userId: number,
    input: ListDeletedDocumentsToolInputDto,
  ): Promise<ListDeletedDocumentsToolResponseDto> {
    const result = await this.documentService.getTrashDocuments(
      userId,
      input.workspaceId,
      input.limit ?? 20,
      input.cursor
        ? { deletedAt: new Date(input.cursor.deletedAt), id: input.cursor.id }
        : undefined,
    );

    return {
      documents: result.documents.map((doc) => ({
        ...doc,
        deletedAt: doc.deletedAt.toISOString(),
      })),
      nextCursor: result.nextCursor
        ? {
            ...result.nextCursor,
            deletedAt: result.nextCursor.deletedAt.toISOString(),
          }
        : null,
    };
  }
}
