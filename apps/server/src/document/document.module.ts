import { Module } from '@nestjs/common';
import { DocumentGateway } from './document.gateway';
import { DocumentService } from './document.service';

@Module({
  imports: [],
  exports: [],
  controllers: [],
  providers: [DocumentGateway, DocumentService],
})
export class DocumentModule {}
