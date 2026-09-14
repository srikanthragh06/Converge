import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DocumentTools } from '../document/document.tools.js';
import { withAgentErrorHandling } from '../utils/agent-error-handling.util.js';
import {
  ListDocumentsToolInputSchema,
  SearchDocumentsToolInputSchema,
  GetDocumentMetadataToolInputSchema,
  ReadDocumentMarkdownToolInputSchema,
  GetDocumentBlocksToolInputSchema,
  UpdateDocumentBlocksToolInputSchema,
  CreateDocumentToolInputSchema,
  UpdateDocumentTitleToolInputSchema,
  DeleteDocumentToolInputSchema,
  ListCheckpointsToolInputSchema,
  GetCheckpointContentToolInputSchema,
  RestoreCheckpointToolInputSchema,
  ListDeletedDocumentsToolInputSchema,
  RestoreDocumentToolInputSchema,
  SearchDocumentContentToolInputSchema,
  GetDocumentIndexingStatusToolInputSchema,
} from '@converge/shared';

/**
 * One tool exposed to the chat agent: a name/description pair plus its Zod
 * input schema (converted to JSON Schema for the OpenAI request via
 * z.toJSONSchema — the same conversion the MCP surface already relies on)
 * and an execute function AgentService looks up and calls itself once the
 * model's tool-call arguments have fully streamed in. The raw `openai` SDK,
 * unlike the Vercel AI SDK's `tool()` helper, does not execute tools for
 * you — this is why execute lives on a plain object here instead of being
 * wired automatically.
 */
export interface AgentToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: unknown) => Promise<unknown>;
}

// Builds the tool set exposed to the chat agent, all calling straight into
// DocumentTools (constructor-injected, same as every other consumer of it)
// — the same methods the MCP surface uses, so a tool call here enforces
// exactly the same access control as an external MCP client would hit, with
// no separate authorization logic added here.
@Injectable()
export class AgentTools {
  constructor(private readonly documentTools: DocumentTools) {}

  /**
   * Builds the tool set for one message, scoped to the conversation's fixed
   * workspace. Workspace-scoped tools (listDocuments, searchDocuments,
   * createDocument, listDeletedDocuments, searchDocumentContent) drop
   * workspaceId from the schema the model sees and bind it to workspaceId
   * instead, since the agent is scoped to one workspace for its whole
   * lifetime. Document-scoped tools take no workspaceId at all —
   * resolveAccess already gates those per-document regardless of which
   * workspace the chat happens to be in. Every execute() body is wrapped in
   * withAgentErrorHandling — see that util for why a thrown error (rather
   * than a returned one) would silently vanish from this app's own
   * persisted conversation history.
   *
   * @param userId - The authenticated caller, used for every underlying access check.
   * @param workspaceId - The calling conversation's fixed workspace, bound into every workspace-scoped tool call.
   */
  build(userId: number, workspaceId: number): AgentToolDefinition[] {
    return [
      {
        name: 'listDocuments',
        description:
          'Lists documents in the current workspace that the caller has access to, newest last-visited first. Supports keyset pagination via the returned nextCursor.',
        inputSchema: z
          .object(ListDocumentsToolInputSchema)
          .omit({ workspaceId: true }),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.listDocuments(userId, {
              ...(input as Omit<
                Parameters<typeof this.documentTools.listDocuments>[1],
                'workspaceId'
              >),
              workspaceId,
            }),
          ),
      },

      {
        name: 'searchDocuments',
        description:
          'Searches documents in the current workspace by title, matching by similarity rather than exact text — ordered by relevance descending. Use this instead of listDocuments when looking for a specific document by name.',
        inputSchema: z
          .object(SearchDocumentsToolInputSchema)
          .omit({ workspaceId: true }),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.searchDocuments(userId, {
              ...(input as Omit<
                Parameters<typeof this.documentTools.searchDocuments>[1],
                'workspaceId'
              >),
              workspaceId,
            }),
          ),
      },

      {
        name: 'getDocumentMetadata',
        description:
          "Fetches a document's metadata: title, workspace, the caller's resolved access level, and createdAt. Does not return content — see getDocumentBlocks/readDocumentMarkdown for that.",
        inputSchema: z.object(GetDocumentMetadataToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.getDocumentMetadata(
              userId,
              input as Parameters<typeof this.documentTools.getDocumentMetadata>[1],
            ),
          ),
      },

      {
        name: 'readDocumentMarkdown',
        description:
          "Reads a document's content as Markdown — lossy (block ids, custom props, and structure Markdown can't express are dropped), read-only.",
        inputSchema: z.object(ReadDocumentMarkdownToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.readDocumentMarkdown(
              userId,
              input as Parameters<typeof this.documentTools.readDocumentMarkdown>[1],
            ),
          ),
      },

      {
        name: 'getDocumentBlocks',
        description:
          "Reads a document's content as BlockNote block JSON, ids and all — not lossy like readDocumentMarkdown. Use this first to find the block ids updateDocumentBlocks needs.",
        inputSchema: z.object(GetDocumentBlocksToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.getDocumentBlocks(
              userId,
              input as Parameters<typeof this.documentTools.getDocumentBlocks>[1],
            ),
          ),
      },

      {
        name: 'updateDocumentBlocks',
        description:
          "Applies a batch of edits to a document's blocks as a single atomic save (all edits apply, or none do). Requires editor access or higher. New content is given as Markdown, not raw block JSON. Use getDocumentBlocks first to find the block ids to target.",
        inputSchema: z.object(UpdateDocumentBlocksToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.updateDocumentBlocks(
              userId,
              input as Parameters<typeof this.documentTools.updateDocumentBlocks>[1],
            ),
          ),
      },

      {
        name: 'createDocument',
        description:
          'Creates a new, empty document in the current workspace and returns its id. Requires at least the member role. Use updateDocumentBlocks afterwards to add content.',
        inputSchema: z
          .object(CreateDocumentToolInputSchema)
          .omit({ workspaceId: true }),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.createDocument(userId, {
              ...(input as Omit<
                Parameters<typeof this.documentTools.createDocument>[1],
                'workspaceId'
              >),
              workspaceId,
            }),
          ),
      },

      {
        name: 'updateDocumentTitle',
        description: 'Renames a document. Requires editor access or higher.',
        inputSchema: z.object(UpdateDocumentTitleToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.updateDocumentTitle(
              userId,
              input as Parameters<typeof this.documentTools.updateDocumentTitle>[1],
            ),
          ),
      },

      {
        name: 'deleteDocument',
        description:
          'Soft-deletes a document. Requires admin access or higher. Use restoreDocument to undo this.',
        inputSchema: z.object(DeleteDocumentToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.deleteDocument(
              userId,
              input as Parameters<typeof this.documentTools.deleteDocument>[1],
            ),
          ),
      },

      {
        name: 'listCheckpoints',
        description:
          "Lists a document's version-history checkpoints, newest first, each with its contributors, source, and last-edited time. Use getCheckpointContent to read a specific one. Requires viewer access or higher.",
        inputSchema: z.object(ListCheckpointsToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.listCheckpoints(
              userId,
              input as Parameters<typeof this.documentTools.listCheckpoints>[1],
            ),
          ),
      },

      {
        name: 'getCheckpointContent',
        description:
          "Reads a version-history checkpoint's full content as BlockNote blocks (same shape as getDocumentBlocks), plus its metadata. Use listCheckpoints first to find a checkpointId. Requires viewer access or higher.",
        inputSchema: z.object(GetCheckpointContentToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.getCheckpointContent(
              userId,
              input as Parameters<typeof this.documentTools.getCheckpointContent>[1],
            ),
          ),
      },

      {
        name: 'restoreCheckpoint',
        description:
          "Restores a document's content to a past checkpoint. Requires editor access or higher. Only restores blocks, not title. A fresh checkpoint is taken immediately before the restore lands, so an unwanted restore is itself just one more restore away from undo. Use listCheckpoints first to find a checkpointId.",
        inputSchema: z.object(RestoreCheckpointToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.restoreCheckpoint(
              userId,
              input as Parameters<typeof this.documentTools.restoreCheckpoint>[1],
            ),
          ),
      },

      {
        name: 'listDeletedDocuments',
        description:
          'Lists soft-deleted documents in the current workspace, newest-deleted first. Only visible to callers with admin access or higher. Use restoreDocument to undo a deletion.',
        inputSchema: z
          .object(ListDeletedDocumentsToolInputSchema)
          .omit({ workspaceId: true }),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.listDeletedDocuments(userId, {
              ...(input as Omit<
                Parameters<typeof this.documentTools.listDeletedDocuments>[1],
                'workspaceId'
              >),
              workspaceId,
            }),
          ),
      },

      {
        name: 'restoreDocument',
        description:
          'Restores a soft-deleted document, undoing deleteDocument. Requires admin access or higher.',
        inputSchema: z.object(RestoreDocumentToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.restoreDocument(
              userId,
              input as Parameters<typeof this.documentTools.restoreDocument>[1],
            ),
          ),
      },

      {
        name: 'searchDocumentContent',
        description:
          'Retrieves the most relevant indexed content in the current workspace for a natural-language question, as cited chunks — hybrid semantic + lexical (BM25) candidates, reranked. Returns grounded content and citations only; synthesizing an answer from them is your job.',
        inputSchema: z
          .object(SearchDocumentContentToolInputSchema)
          .omit({ workspaceId: true }),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.searchDocumentContent(userId, {
              ...(input as Omit<
                Parameters<typeof this.documentTools.searchDocumentContent>[1],
                'workspaceId'
              >),
              workspaceId,
            }),
          ),
      },

      {
        name: 'getDocumentIndexingStatus',
        description:
          "Returns a document's RAG indexing status: its lifecycle state (idle/pending/indexing) and when it was last confirmed indexed. Requires viewer access or higher.",
        inputSchema: z.object(GetDocumentIndexingStatusToolInputSchema),
        execute: (input) =>
          withAgentErrorHandling(() =>
            this.documentTools.getDocumentIndexingStatus(
              userId,
              input as Parameters<typeof this.documentTools.getDocumentIndexingStatus>[1],
            ),
          ),
      },
    ];
  }
}
