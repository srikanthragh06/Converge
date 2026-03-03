// Owns the two ioredis clients: pub for publishing commands, sub dedicated to subscriptions.
// A Redis connection in subscriber mode cannot issue other commands, so two
// separate clients are required.
// Both use lazyConnect: true so TCP connections are deferred to waitForRedis().

import Redis from "ioredis";
import { sleep } from "../utils/utils";

export class RedisService {
    // Public readonly so the container can expose them via services.redisService.pub/.sub.
    public readonly pub: Redis;
    public readonly sub: Redis;

    private static readonly MAX_RETRIES = 10;
    private static readonly RETRY_DELAY_MS = 3000;

    constructor() {
        // Read REDIS_URL from environment — same pattern as DatabaseService reading POSTGRES_*.
        const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
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
