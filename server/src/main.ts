// dotenv.config() must run before any other import that reads process.env,
// so it is called here at the top of the entry point.
import dotenv from "dotenv";
dotenv.config();

import { server } from "./server";
import { waitForDb, migrate } from "./db";
import { waitForRedis } from "./redis";
import { initPubSub } from "./redis/pubsub";
import { startSweeper } from "./store/docStore";

const PORT = Number(process.env.PORT) || 5000;

// Async IIFE: Postgres and Redis must be ready before accepting connections.
// Doc loading is lazy — triggered on first client access via getDoc(), not here.
(async () => {
    // 1. Wait for Postgres and Redis in parallel — both are infrastructure deps
    //    and neither depends on the other, so starting them together saves time
    //    on Docker cold starts where both services may be warming up simultaneously.
    await Promise.all([waitForDb(), waitForRedis()]);

    // 2. Apply schema migrations idempotently (Postgres is ready after step 1)
    await migrate();

    // 3. Register the Redis pub/sub message handler — must run before any client
    //    connects so the sub client is ready to receive cross-server updates.
    initPubSub();

    // 4. Start the background sweeper that evicts idle docs from memory
    startSweeper();

    // 5. Open the HTTP + Socket.IO listener — safe now that infra is ready
    server.listen(PORT, () => {
        console.log(`Server running on :${PORT}`);
    });
})();
