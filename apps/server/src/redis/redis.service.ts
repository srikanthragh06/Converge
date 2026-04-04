import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { sleep } from '../utils/utils';

/** Manages the two ioredis connections used for pub/sub messaging. */
@Injectable()
export class RedisService {
  /** Publishes Yjs updates to other server instances. */
  public readonly pub: Redis;

  /**
   * Subscribes to Yjs updates from other server instances.
   * A Redis connection in subscribe mode cannot issue regular commands,
   * so a separate client is required for publishing.
   */
  public readonly sub: Redis;

  /** Maximum number of connection attempts before giving up. */
  private static readonly MAX_RETRIES = 10;

  /** Milliseconds to wait between connection attempts. */
  private static readonly RETRY_DELAY_MS = 3000;

  constructor(private readonly configService: ConfigService) {
    const environment = this.configService.getOrThrow<string>('ENVIRONMENT');

    let redisUrl: string;
    if (environment === 'DEV') {
      redisUrl = this.configService.getOrThrow<string>('REDIS_DEV_URL');
    } else if (environment === 'PROD') {
      redisUrl = this.configService.getOrThrow<string>('REDIS_PROD_URL');
    } else {
      throw new Error(`Unknown ENVIRONMENT "${environment}"`);
    }

    // lazyConnect defers the TCP handshake to verifyRedisConnection() so the
    // constructor never throws and startup ordering is explicit.
    this.pub = new Redis(redisUrl, { lazyConnect: true });
    this.sub = new Redis(redisUrl, { lazyConnect: true });
  }

  /**
   * Connects both Redis clients and sends a PING to confirm the connection
   * is live. Retries with a fixed delay up to MAX_RETRIES times before
   * throwing, preventing the app from starting with no message broker.
   */
  async verifyRedisConnection(): Promise<void> {
    for (let attempt = 1; attempt <= RedisService.MAX_RETRIES; attempt++) {
      try {
        await this.pub.connect();
        await this.sub.connect();
        await this.pub.ping();
        console.log('Redis connection established');
        return;
      } catch (err) {
        this.pub.disconnect();
        this.sub.disconnect();
        if (attempt < RedisService.MAX_RETRIES) {
          console.log(
            `Redis not ready, retrying in ${RedisService.RETRY_DELAY_MS / 1000}s... (${attempt}/${RedisService.MAX_RETRIES})`,
          );
          await sleep(RedisService.RETRY_DELAY_MS);
        } else {
          throw new Error(
            `Redis unavailable after ${RedisService.MAX_RETRIES} attempts: ${String(err)}`,
          );
        }
      }
    }
  }
}
