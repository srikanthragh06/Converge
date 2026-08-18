import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';

// Hosts the MCP (Model Context Protocol) server surface — currently a single
// no-op tool, used to validate the Streamable HTTP transport wiring before
// any real Converge tools are added.
@Module({
  controllers: [McpController],
})
export class McpModule {}
