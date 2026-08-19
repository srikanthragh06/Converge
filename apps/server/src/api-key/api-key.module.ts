import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { ApiKeyController } from './api-key.controller.js';
import { DatabaseModule } from '../db/database.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyGuard],
  exports: [ApiKeyService, ApiKeyGuard],
})
export class ApiKeyModule {}
