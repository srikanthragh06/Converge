import { Module } from '@nestjs/common';
import { DocumentGateway } from './document.gateway';
import { DocumentService } from './document.service';
import { DatabaseModule } from '../db/database.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  exports: [],
  controllers: [],
  providers: [DocumentGateway, DocumentService],
})
export class DocumentModule {}
