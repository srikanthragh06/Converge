// Redis startup helpers — mirrors the pattern in db/index.ts.
// waitForRedis() is called from main.ts alongside waitForDb() before server.listen().

import { pub, sub } from "./client";

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Polls Redis until both pub and sub connections succeed or retries are exhausted.
// Both clients use lazyConnect: true so this is the point where TCP connections
// are actually established. On failure the clients are disconnected so the next
// attempt starts from a clean state (ioredis treats disconnect + reconnect as fresh).
export const waitForRedis = async (): Promise<void> => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await pub.connect();
            await sub.connect();
            // Ping through the pub client to confirm the connection is functional.
            await pub.ping();
            console.log("Redis connection established");
            return;
        } catch (err) {
            // Disconnect both so the next attempt starts clean.
            pub.disconnect();
            sub.disconnect();
            if (attempt < MAX_RETRIES) {
                console.log(
                    `Redis not ready, retrying in ${RETRY_DELAY_MS / 1000}s... (${attempt}/${MAX_RETRIES})`,
                );
                await sleep(RETRY_DELAY_MS);
            } else {
                throw new Error(
                    `Redis unavailable after ${MAX_RETRIES} attempts: ${String(err)}`,
                );
            }
        }
    }
};

export { pub, sub };
