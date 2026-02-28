// Two ioredis clients: pub for publishing commands, sub dedicated to subscriptions.
// A Redis connection in subscriber mode cannot issue other commands, so two
// separate clients are required.
// Both use lazyConnect: true so the TCP connection is deferred to waitForRedis()
// in redis/index.ts rather than being attempted at module import time.

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// General-purpose publisher client — used by pubsub.ts publishUpdate().
export const pub = new Redis(REDIS_URL, { lazyConnect: true });

// Dedicated subscriber client — used by pubsub.ts subscribeDoc() / unsubscribeDoc().
// Once sub.subscribe() is called this client can only run subscribe-family commands.
export const sub = new Redis(REDIS_URL, { lazyConnect: true });
