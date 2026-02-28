// dotenv.config() must run before any other import that reads process.env,
// so it is called here at the top of the entry point.
import dotenv from "dotenv";
dotenv.config();

import { server } from "./server";
import { waitForDb, migrate } from "./db";
import { startSweeper } from "./docStore";

const PORT = Number(process.env.PORT) || 5000;

// Async IIFE: Postgres must be ready and schema correct before accepting connections.
// Doc loading is lazy — triggered on first client access via getDoc(), not here.
(async () => {
    // 1. Wait for Postgres to accept connections (retries on Docker cold start)
    await waitForDb();

    // 2. Apply schema migrations idempotently
    await migrate();

    // 3. Start the background sweeper that evicts idle docs from memory
    startSweeper();

    // 4. Open the HTTP + Socket.IO listener — safe now that the schema is ready
    server.listen(PORT, () => {
        console.log(`Server running on :${PORT}`);
    });
})();
