import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { DatabaseModule } from '../db/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { WorkspaceModule } from '../workspace/workspace.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspaceModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
