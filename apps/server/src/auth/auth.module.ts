import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../db/database.module';
import { AuthGuard } from './auth.guard';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  imports: [HttpModule, DatabaseModule, forwardRef(() => WorkspaceModule)],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
