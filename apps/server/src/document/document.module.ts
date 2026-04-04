import { Module } from '@nestjs/common';
import { DocumentGateway } from './document.gateway';
import { DocumentService } from './document.service';
import { DatabaseModule } from '../db/database.module';

@Module({
  imports: [DatabaseModule],
  exports: [],
  controllers: [],
  providers: [DocumentGateway, DocumentService],
})
export class DocumentModule {}
