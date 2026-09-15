import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../db/database.module.js';
import { AuthGuard } from './auth.guard.js';
import { GoogleAuthRateLimitGuard } from './google-auth-rate-limit.guard.js';
import { RedisModule } from '../redis/redis.module.js';
import { WorkspaceModule } from '../workspace/workspace.module.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, GoogleAuthRateLimitGuard],
  imports: [
    HttpModule,
    DatabaseModule,
    RedisModule,
    forwardRef(() => WorkspaceModule),
  ],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
