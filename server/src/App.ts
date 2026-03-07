// Lifecycle orchestrator: waits for infrastructure, runs migrations, then opens the port.
// All service instances are accessed from the global container module.

import { servicesStore } from "./store/servicesStore";

export class App {
    constructor(private readonly port: number) {}

    // Startup sequence: wire connection handler → wait for infra → migrate → init pub/sub
    //                   → start sweeper → listen
    async start(): Promise<void> {
        // Register REST routes before listen() so all routes are available on startup.
        servicesStore.controllerService.registerRoutes();

        // Wire the connection handler before listen() so no connection can arrive
        // on an unwired server.
        servicesStore.httpServerService.io.on("connection", (socket) => {
            servicesStore.socketHandlerService.handleConnection(socket);
        });

        // Wait for Postgres and Redis in parallel — neither depends on the other.
        await Promise.all([
            servicesStore.databaseService.waitForDb(),
            servicesStore.redisService.waitForRedis(),
        ]);

        // Apply schema migrations after Postgres is confirmed ready.
        await servicesStore.databaseService.migrate();

        // Register the Redis pub/sub message handler — must be live before any client
        // connects so the sub client is ready to receive cross-server updates.
        servicesStore.pubSubService.init();

        // Start the background sweeper that evicts idle docs from memory.
        servicesStore.docStoreService.setYDocSweepInterval();

        // Open the HTTP + Socket.IO listener — safe now that all infra is ready.
        servicesStore.httpServerService.listen(this.port);
    }
}
