import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller.js';
import { ApiKeyModule } from '../api-key/api-key.module.js';
import { DocumentModule } from '../document/document.module.js';

// Hosts the MCP (Model Context Protocol) server surface. Tool logic itself
// lives in each feature module (e.g. DocumentTools in DocumentModule) — this
// module only wires those tools to the Streamable HTTP transport.
@Module({
  imports: [ApiKeyModule, DocumentModule],
  controllers: [McpController],
})
export class McpModule {}
