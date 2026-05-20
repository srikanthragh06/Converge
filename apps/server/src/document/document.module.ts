import { Module } from '@nestjs/common';
import { DocumentGateway } from './document.gateway';
import { DocumentService } from './document.service';
import { DatabaseModule } from '../db/database.module';
import { RedisModule } from '../redis/redis.module';
import { DocumentController } from './document.controller';
import { DocumentAccessController } from './document-access.controller';
import { DocumentYjsService } from './document-yjs.service';
import { DocumentAccessService } from './document-access.service';
import { DocumentAwarenessService } from './document-awareness.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, RedisModule, AuthModule],
  exports: [],
  controllers: [DocumentController, DocumentAccessController],
  providers: [DocumentGateway, DocumentService, DocumentYjsService, DocumentAccessService, DocumentAwarenessService],
})
export class DocumentModule {}
