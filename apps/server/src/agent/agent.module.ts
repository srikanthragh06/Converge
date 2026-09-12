import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { AgentTools } from './agent.tools.js';
import { DatabaseModule } from '../db/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { WorkspaceModule } from '../workspace/workspace.module.js';
import { DocumentModule } from '../document/document.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspaceModule, DocumentModule],
  controllers: [AgentController],
  providers: [AgentService, AgentTools],
})
export class AgentModule {}
