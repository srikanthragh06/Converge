import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { DocumentModule } from './document/document.module';
import { DatabaseModule } from './db/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';

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
    // Registered in the root module so ThrottlerModule is available to all guards without
    // re-importing. Uses a dedicated Redis client for storage so counters are shared across
    // all server instances — prevents the per-instance in-memory default from multiplying limits.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const environment = configService.getOrThrow<string>('ENVIRONMENT');
        let redisUrl: string;
        if (environment === 'DEV') {
          redisUrl = configService.getOrThrow<string>('REDIS_DEV_URL');
        } else if (environment === 'PROD') {
          redisUrl = configService.getOrThrow<string>('REDIS_PROD_URL');
        } else {
          throw new Error(`Unknown ENVIRONMENT "${environment}"`);
        }
        return {
          storage: new ThrottlerStorageRedisService(new Redis(redisUrl)),
          throttlers: [{ name: 'default', ttl: 60000, limit: 10 }],
        };
      },
    }),
    DocumentModule,
    // DatabaseModule wires up the Kysely/pg connection pool and exports
    // DatabaseService so any feature module can inject it without re-importing.
    DatabaseModule,
    // RedisModule wires up the ioredis pub/sub clients and exports RedisService
    // so any feature module can inject it without re-importing.
    RedisModule,
    AuthModule,
    WorkspaceModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
