import { Module } from '@nestjs/common';
import { DocumentGateway } from './document.gateway';

@Module({
  imports: [],
  exports: [],
  controllers: [],
  providers: [DocumentGateway],
})
export class DocumentModule {}
