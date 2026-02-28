// Composition root: constructs and wires all service classes.
// This is the only place that knows about every dependency — all other classes
// receive what they need via constructor injection.
//
// PubSub receives the Socket.IO server instance directly so it can broadcast
// to local clients without any circular module imports.

import { Database } from "./db/Database";
import { Persistence } from "./db/Persistence";
import { RedisClient } from "./redis/RedisClient";
import { PubSub } from "./redis/PubSub";
import { DocStore } from "./store/DocStore";
import { SocketHandler } from "./sockets/SocketHandler";
import { HttpServer } from "./HttpServer";

export class App {
    private readonly database: Database;
    private readonly persistence: Persistence;
    private readonly redisClient: RedisClient;
    private readonly pubSub: PubSub;
    private readonly docStore: DocStore;
    private readonly socketHandler: SocketHandler;
    private readonly httpServer: HttpServer;

    constructor(private readonly port: number) {
        // Infrastructure — no custom dependencies between these three
        this.database = new Database();
        this.httpServer = new HttpServer();
        this.redisClient = new RedisClient(
            process.env.REDIS_URL ?? "redis://localhost:6379",
        );

        // Persistence receives the Kysely instance from Database
        this.persistence = new Persistence(this.database.kysely);

        // PubSub receives the Socket.IO server so it can broadcast to local clients
        this.pubSub = new PubSub(
            this.redisClient.pub,
            this.redisClient.sub,
            this.httpServer.io,
        );

        // DocStore and SocketHandler receive their dependencies via constructor
        this.docStore = new DocStore(this.persistence, this.pubSub);
        this.socketHandler = new SocketHandler(
            this.docStore,
            this.persistence,
            this.pubSub,
        );

        // Wire the connection handler before listen() is called
        this.httpServer.io.on("connection", (socket) => {
            this.socketHandler.handleConnection(socket);
        });
    }

    // Startup sequence: wait for infra → migrate → init pub/sub → start sweeper → listen
    async start(): Promise<void> {
        // Wait for Postgres and Redis in parallel — neither depends on the other
        await Promise.all([
            this.database.waitForDb(),
            this.redisClient.waitForRedis(),
        ]);

        // Apply schema migrations after Postgres is confirmed ready
        await this.database.migrate();

        // Register the Redis pub/sub message handler — must be live before any client
        // connects so the sub client is ready to receive cross-server updates
        this.pubSub.init();

        // Start the background sweeper that evicts idle docs from memory
        this.docStore.startSweeper();

        // Open the HTTP + Socket.IO listener — safe now that all infra is ready
        this.httpServer.listen(this.port);
    }
}
