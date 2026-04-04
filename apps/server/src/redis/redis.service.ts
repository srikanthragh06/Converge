import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { sleep } from '../utils/utils';

/** Manages the two ioredis connections used for pub/sub messaging. */
@Injectable()
export class RedisService {
  /**
   * Unique identifier for this server instance, generated once at startup.
   * Included in every published message so subscribers can detect and skip
   * their own echoed messages.
   */
  private readonly clientId: string = randomUUID();

  /** Publishes messages to other server instances. */
  private readonly pub: Redis;

  /**
   * Listens for messages from other server instances.
   * A Redis connection in subscribe mode cannot issue regular commands,
   * so a separate client is required for publishing.
   */
  private readonly sub: Redis;

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

  /**
   * Publishes a message to the given channel, automatically attaching this
   * server's clientId so subscribers can skip their own echoed messages.
   * Errors are logged but not re-thrown — a publish failure should not
   * affect the client that triggered the update.
   * @param channel - the Redis pub/sub channel to publish to
   * @param data - the payload to include alongside the clientId
   */
  publish(channel: string, data: Record<string, unknown>): void {
    const message = JSON.stringify({ clientId: this.clientId, ...data });
    this.pub.publish(channel, message).catch((err: unknown) => {
      console.error(`Failed to publish to Redis channel "${channel}":`, err);
    });
  }

  /**
   * Subscribes to a Redis channel and invokes the handler for each incoming
   * message. Messages published by this server instance are automatically
   * skipped to prevent echo loops.
   * @param channel - the Redis pub/sub channel to subscribe to
   * @param handler - called with the parsed message payload for each foreign message
   */
  async subscribe(
    channel: string,
    handler: (message: Record<string, unknown>) => void,
  ): Promise<void> {
    await this.sub.subscribe(channel);
    this.sub.on('message', (msgChannel, raw) => {
      if (msgChannel !== channel) return;
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        console.error(
          `Received malformed JSON on Redis channel "${channel}":`,
          raw,
        );
        return;
      }
      // Skip messages published by this server instance.
      if (message.clientId === this.clientId) return;
      handler(message);
    });
  }
}
