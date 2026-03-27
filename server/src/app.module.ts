import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

// Root module — the entry point of the NestJS DI container.
// All feature modules (DocumentModule, UserModule, etc.) get imported here.
// Think of this as the composition root of the application.
@Module({
  imports: [], // feature modules go here
  controllers: [AppController],
  providers: [], // global providers go here
})
export class AppModule {}
