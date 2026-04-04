import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { DocumentModule } from './document/document.module';
import { DatabaseModule } from './db/database.module';

// Root module — the entry point of the NestJS DI container.
// All feature modules (DocumentModule, UserModule, etc.) get imported here.
// Think of this as the composition root of the application.
@Module({
  imports: [
    // isGlobal makes ConfigService available everywhere without re-importing ConfigModule.
    // envFilePath mirrors env.loader.ts: environment-specific file first, .env as fallback.
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'dev'}`, '.env'],
      isGlobal: true,
    }),
    DocumentModule,
    // DatabaseModule wires up the Kysely/pg connection pool and exports
    // DatabaseService so any feature module can inject it without re-importing.
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
