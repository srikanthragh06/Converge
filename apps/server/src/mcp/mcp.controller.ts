import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ApiKeyGuard } from '../api-key/api-key.guard.js';
import { DocumentTools } from '../document/document.tools.js';
import {
  ListDocumentsToolInputSchema,
  GetLibraryDocumentsResponseSchema,
  GetDocumentMetadataToolInputSchema,
  GetDocumentResponseSchema,
  ReadDocumentMarkdownToolInputSchema,
  ReadDocumentMarkdownResponseSchema,
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
          "Lists documents in a workspace that the caller has access to, newest last-visited first. Supports keyset pagination via the returned nextCursor.",
        inputSchema: ListDocumentsToolInputSchema,
        outputSchema: GetLibraryDocumentsResponseSchema,
      },
      async (input) => {
        const result = await this.documentTools.listDocuments(userId, input);
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
      'getDocumentMetadata',
      {
        title: 'Get Document Metadata',
        description:
          "Fetches a document's metadata (title, workspace, resolved access, createdAt). Does not return document content — see getDocumentBlocks/getDocumentMarkdown for that.",
        inputSchema: GetDocumentMetadataToolInputSchema,
        outputSchema: GetDocumentResponseSchema,
      },
      async (input) => {
        const result = await this.documentTools.getDocumentMetadata(userId, input);
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
        const result = await this.documentTools.readDocumentMarkdown(userId, input);
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
