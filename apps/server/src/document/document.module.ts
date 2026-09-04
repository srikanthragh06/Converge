import { Module } from '@nestjs/common';
import { DocumentGateway } from './document.gateway.js';
import { DocumentService } from './document.service.js';
import { DatabaseModule } from '../db/database.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { DocumentController } from './document.controller.js';
import { DocumentAccessController } from './document-access.controller.js';
import { DocumentYjsService } from './document-yjs.service.js';
import { DocumentAccessService } from './document-access.service.js';
import { DocumentAwarenessService } from './document-awareness.service.js';
import { DocumentCheckpointService } from './document-checkpoint.service.js';
import { DocumentCheckpointSchedulerService } from './document-checkpoint-scheduler.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { DocumentTools } from './document.tools.js';
import { DocumentEmbeddingService } from './document-embedding.service.js';
import { DocumentIndexingService } from './document-indexing.service.js';

@Module({
  imports: [DatabaseModule, RedisModule, AuthModule],
  exports: [DocumentCheckpointSchedulerService, DocumentTools],
  controllers: [DocumentController, DocumentAccessController],
  providers: [
    DocumentGateway,
    DocumentService,
    DocumentYjsService,
    DocumentAccessService,
    DocumentAwarenessService,
    DocumentCheckpointService,
    DocumentCheckpointSchedulerService,
    DocumentTools,
    DocumentEmbeddingService,
    DocumentIndexingService,
  ],
})
export class DocumentModule {}
