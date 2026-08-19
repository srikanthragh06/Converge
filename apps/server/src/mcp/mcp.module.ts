import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { ApiKeyModule } from '../api-key/api-key.module';
import { DocumentModule } from '../document/document.module';

// Hosts the MCP (Model Context Protocol) server surface. Tool logic itself
// lives in each feature module (e.g. DocumentTools in DocumentModule) — this
// module only wires those tools to the Streamable HTTP transport.
@Module({
  imports: [ApiKeyModule, DocumentModule],
  controllers: [McpController],
})
export class McpModule {}
