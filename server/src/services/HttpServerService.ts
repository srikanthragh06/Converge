// HTTP server setup: Express app, raw http.Server, and Socket.IO server.
// Construction and listening are intentionally separated so App can wire
// all connection handlers before opening the port to clients.

import express, { Express } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import { ClientToServerEvents, ServerToClientEvents } from "../types/types";

export class HttpServerService {
    public readonly expressApp: Express;
    public readonly httpServer: http.Server;
    public readonly io: SocketIOServer<
        ClientToServerEvents,
        ServerToClientEvents
    >;

    // Only the Vite dev server is allowed to connect (browser origin).
    private static readonly ALLOWED_ORIGINS = ["http://localhost:5173"];

    constructor() {
        this.expressApp = express();
        this.expressApp.use(
            cors({ origin: HttpServerService.ALLOWED_ORIGINS }),
        );

        // Wrap Express in a raw http.Server so Socket.IO and Express share one port.
        this.httpServer = http.createServer(this.expressApp);

        // Attach Socket.IO to the shared http.Server with typed event generics.
        // path: '/socket' namespaces the upgrade request away from any future REST routes.
        this.io = new SocketIOServer<
            ClientToServerEvents,
            ServerToClientEvents
        >(this.httpServer, {
            cors: {
                origin: HttpServerService.ALLOWED_ORIGINS,
                methods: ["GET", "POST"],
            },
            path: "/socket",
        });
    }

    // Starts listening. Called by App.start() after all dependencies are ready.
    listen(port: number): void {
        this.httpServer.listen(port, () => {
            console.log(`Server running on :${port}`);
        });
    }
}
