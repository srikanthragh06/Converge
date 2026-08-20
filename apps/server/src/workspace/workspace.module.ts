import { forwardRef, Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';
import { WorkspaceTools } from './workspace.tools.js';
import { DatabaseModule } from '../db/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceTools],
  exports: [WorkspaceService, WorkspaceTools],
})
export class WorkspaceModule {}
