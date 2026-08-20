import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ApiKeyGuard } from '../api-key/api-key.guard.js';
import { DocumentTools } from '../document/document.tools.js';
import { withMcpErrorHandling } from '../utils/mcp-error-handling.util.js';
import {
  ListDocumentsToolInputSchema,
  ListDocumentsToolResponseSchema,
  GetDocumentMetadataToolInputSchema,
  GetDocumentMetadataToolResponseSchema,
  ReadDocumentMarkdownToolInputSchema,
  ReadDocumentMarkdownResponseSchema,
  GetDocumentBlocksToolInputSchema,
  GetDocumentBlocksResponseSchema,
  UpdateDocumentBlocksToolInputSchema,
  UpdateDocumentBlocksResponseSchema,
  CreateDocumentToolInputSchema,
  CreateDocumentResponseSchema,
  UpdateDocumentTitleToolInputSchema,
  UpdateDocumentTitleResponseSchema,
} from '@converge/shared';

// Exposes a single MCP endpoint over the Streamable HTTP transport. The MCP
// SDK owns the raw request/response lifecycle itself (JSON-RPC parsing,
// choosing between a plain JSON reply or an SSE stream), which doesn't fit
// Nest's usual "return a value, let Nest serialize it" controller model —
// so this route opts out of Nest's automatic response handling and hands
// the raw Express req/res straight to the SDK's transport instead.
// Guarded by ApiKeyGuard rather than AuthGuard — callers here are agents
// (MCP clients), not a browser with a session cookie.
@Controller('/mcp')
@UseGuards(ApiKeyGuard)
export class McpController {
  constructor(private readonly documentTools: DocumentTools) {} // Supplies the actual tool logic; this controller only wires it to the transport.

  /**
   * Handles a single MCP JSON-RPC request over Streamable HTTP.
   * Runs in stateless mode — a fresh McpServer and transport are created
   * per request rather than persisted across a session, since this route
   * has no session state (see McpModule's docs for why). The calling
   * user's ID, resolved by ApiKeyGuard, is captured in the tool handler
   * closures below so each registered tool can enforce access control.
   * @param req - the raw Express request, forwarded to the SDK untouched
   * @param res - the raw Express response; the SDK writes directly to it
   */
  @Post()
  async handleMcpRequest(@Req() req: Request, @Res() res: Response) {
    const userId = (req as any).userId as number;
    const server = new McpServer({ name: 'converge-mcp', version: '0.0.1' });

    server.registerTool(
      'listDocuments',
      {
        title: 'List Documents',
        description:
          'Lists documents in a workspace that the caller has access to, newest last-visited first. Supports keyset pagination via the returned nextCursor.',
        inputSchema: ListDocumentsToolInputSchema,
        outputSchema: ListDocumentsToolResponseSchema,
      },
      async (input) => {
        const result = await withMcpErrorHandling(() =>
          this.documentTools.listDocuments(userId, input),
        );
        // Both fields carry the same data: content's text block is what a
        // calling model actually reads in-context, while structuredContent
        // is the schema-validated form for programmatic consumers — a
        // client isn't guaranteed to forward one into the other.
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result,
        };
      },
    );

    server.registerTool(
      'createDocument',
      {
        title: 'Create Document',
        description:
          'Creates a new, empty document in a workspace and returns its id. Optionally set an initial title. The caller must be at least a member of the workspace. Use updateDocumentBlocks to add content to the new document.',
        inputSchema: CreateDocumentToolInputSchema,
        outputSchema: CreateDocumentResponseSchema,
      },
      async (input) => {
        const result = await withMcpErrorHandling(() =>
          this.documentTools.createDocument(userId, input),
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result,
        };
      },
    );

    server.registerTool(
      'getDocumentMetadata',
      {
        title: 'Get Document Metadata',
        description:
          "Fetches a document's metadata (title, workspace, resolved access, createdAt). Does not return document content — see getDocumentBlocks/getDocumentMarkdown for that.",
        inputSchema: GetDocumentMetadataToolInputSchema,
        outputSchema: GetDocumentMetadataToolResponseSchema,
      },
      async (input) => {
        const result = await withMcpErrorHandling(() =>
          this.documentTools.getDocumentMetadata(userId, input),
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result,
        };
      },
    );

    server.registerTool(
      'readDocumentMarkdown',
      {
        title: 'Read Document Markdown',
        description:
          "Reads a document's content as Markdown — lossy (block ids, custom props, and structure Markdown can't express are dropped), read-only. See getDocumentMetadata for title/workspace/access info.",
        inputSchema: ReadDocumentMarkdownToolInputSchema,
        outputSchema: ReadDocumentMarkdownResponseSchema,
      },
      async (input) => {
        const result = await withMcpErrorHandling(() =>
          this.documentTools.readDocumentMarkdown(userId, input),
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result,
        };
      },
    );

    server.registerTool(
      'getDocumentBlocks',
      {
        title: 'Get Document Blocks',
        description:
          "Reads a document's content as BlockNote block JSON, ids and all — not lossy like readDocumentMarkdown, since it returns the exact underlying block structure rather than a Markdown conversion.",
        inputSchema: GetDocumentBlocksToolInputSchema,
        outputSchema: GetDocumentBlocksResponseSchema,
      },
      async (input) => {
        const result = await withMcpErrorHandling(() =>
          this.documentTools.getDocumentBlocks(userId, input),
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result,
        };
      },
    );

    server.registerTool(
      'updateDocumentBlocks',
      {
        title: 'Update Document Blocks',
        description:
          "Applies a batch of edits to a document's blocks as a single atomic save (all edits apply, or none do). Each edit either replaces an existing block, inserts new content next to one, or removes blocks — new content is given as Markdown, not raw block JSON. Use getDocumentBlocks first to find the block ids to target.",
        inputSchema: UpdateDocumentBlocksToolInputSchema,
        outputSchema: UpdateDocumentBlocksResponseSchema,
      },
      async (input) => {
        const result = await withMcpErrorHandling(() =>
          this.documentTools.updateDocumentBlocks(userId, input),
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result,
        };
      },
    );

    server.registerTool(
      'updateDocumentTitle',
      {
        title: 'Update Document Title',
        description: 'Renames a document. Requires editor access or higher.',
        inputSchema: UpdateDocumentTitleToolInputSchema,
        outputSchema: UpdateDocumentTitleResponseSchema,
      },
      async (input) => {
        const result = await withMcpErrorHandling(() =>
          this.documentTools.updateDocumentTitle(userId, input),
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          structuredContent: result,
        };
      },
    );

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Nest's Express body parser has already consumed and parsed the
    // request body by this point, so it's passed in explicitly here rather
    // than having the transport re-read the (already-drained) stream.
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
