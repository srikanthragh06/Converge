import { Module } from '@nestjs/common';
import { DocumentGateway } from './document.gateway';
import { DocumentService } from './document.service';
import { DatabaseModule } from '../db/database.module';
import { RedisModule } from '../redis/redis.module';
import { DocumentController } from './document.controller';
import { DocumentAccessController } from './document-access.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, RedisModule, AuthModule],
  exports: [],
  controllers: [DocumentController, DocumentAccessController],
  providers: [DocumentGateway, DocumentService],
})
export class DocumentModule {}
