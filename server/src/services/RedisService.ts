// Owns the two ioredis clients: pub for publishing commands, sub dedicated to subscriptions.
// A Redis connection in subscriber mode cannot issue other commands, so two
// separate clients are required.
// Both use lazyConnect: true so TCP connections are deferred to waitForRedis().
//
// Redis URL is split by ENVIRONMENT (ENV_DEV | ENV_PROD):
//   DEV  — REDIS_DEV_URL (local docker-compose redis container)
//   PROD — REDIS_PROD_URL (production Redis, e.g. Upstash)
// Throws at construction time if ENVIRONMENT is missing or the URL is unset.

import Redis from "ioredis";
import { sleep } from "../utils/utils";
import { ENV_DEV, ENV_PROD } from "../constants/constants";

export class RedisService {
    // Public readonly so the container can expose them via services.redisService.pub/.sub.
    public readonly pub: Redis;
    public readonly sub: Redis;

    private static readonly MAX_RETRIES = 10;
    private static readonly RETRY_DELAY_MS = 3000;

    constructor() {
        const environment = process.env.ENVIRONMENT;

        // Resolve the Redis URL for the current environment.
        // DEV points to the local docker-compose redis container;
        // PROD points to a managed Redis (e.g. Upstash), injected via server/.env.
        let redisUrl: string | undefined = undefined;
        if (environment === ENV_DEV) {
            redisUrl = process.env.REDIS_DEV_URL;
        } else if (environment === ENV_PROD) {
            redisUrl = process.env.REDIS_PROD_URL;
        } else {
            throw new Error(
                `Unknown ENVIRONMENT "${environment}" — expected "${ENV_DEV}" or "${ENV_PROD}"`,
            );
        }

        if (redisUrl === undefined) {
            throw new Error(
                `REDIS_${environment}_URL is not set for ENVIRONMENT="${environment}"`,
            );
        }

        // Two separate clients are required: ioredis subscriber connections
        // cannot issue regular commands, so pub and sub must be independent.
        // lazyConnect: true defers the TCP handshake to waitForRedis().
        this.pub = new Redis(redisUrl, { lazyConnect: true });
        this.sub = new Redis(redisUrl, { lazyConnect: true });
    }

    // Connects both clients and pings pub to confirm the connection is functional.
    // On failure both clients are disconnected so the next attempt starts clean.
    async waitForRedis(): Promise<void> {
        for (let attempt = 1; attempt <= RedisService.MAX_RETRIES; attempt++) {
            try {
                await this.pub.connect();
                await this.sub.connect();
                await this.pub.ping();
                console.log("Redis connection established");
                return;
            } catch (err) {
                // Disconnect both so the next attempt starts from a clean state.
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
