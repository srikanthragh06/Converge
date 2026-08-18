import { Controller, Post, Req, Res } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// Exposes a single MCP endpoint over the Streamable HTTP transport. The MCP
// SDK owns the raw request/response lifecycle itself (JSON-RPC parsing,
// choosing between a plain JSON reply or an SSE stream), which doesn't fit
// Nest's usual "return a value, let Nest serialize it" controller model —
// so this route opts out of Nest's automatic response handling and hands
// the raw Express req/res straight to the SDK's transport instead.
@Controller('/mcp')
export class McpController {
  /**
   * Handles a single MCP JSON-RPC request over Streamable HTTP.
   * Runs in stateless mode — a fresh McpServer and transport are created
   * per request rather than persisted across a session, since this route
   * has no session/auth state yet. Registers one dummy "ping" tool used to
   * validate that the transport wiring itself works end to end.
   * @param req - the raw Express request, forwarded to the SDK untouched
   * @param res - the raw Express response; the SDK writes directly to it
   */
  @Post()
  async handleMcpRequest(@Req() req: Request, @Res() res: Response) {
    const server = new McpServer({ name: 'converge-mcp', version: '0.0.1' });

    server.registerTool(
      'ping',
      {
        title: 'Ping',
        description:
          'No-op test tool used to verify the MCP transport is wired up correctly. Always returns "ok".',
      },
      async () => ({
        content: [{ type: 'text' as const, text: 'ok' }],
      }),
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
