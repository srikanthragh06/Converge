// HTTP server setup: Express app, raw http.Server, and Socket.IO server.
// Construction and listening are intentionally separated so App can wire
// all connection handlers before opening the port to clients.

import express, { Express } from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import { ClientToServerEvents, ServerToClientEvents } from "../types/types";
import { ENV_DEV, ENV_PROD } from "../constants/constants";

export class HttpServerService {
    public readonly expressApp: Express;
    public readonly httpServer: http.Server;
    public readonly io: SocketIOServer<
        ClientToServerEvents,
        ServerToClientEvents
    >;

    constructor() {
        // PROD_WEB_URL / LOCAL_WEB_URL must be set — used to restrict CORS to the frontend origin.
        const environment = process.env.ENVIRONMENT;
        let webUrl: string | undefined = undefined;
        if (environment === ENV_PROD) {
            webUrl = process.env.PROD_WEB_URL;
        } else if (environment === ENV_DEV) {
            webUrl = process.env.LOCAL_WEB_URL;
        } else {
            throw new Error(
                `Unknown ENVIRONMENT "${environment}" — expected "${ENV_DEV}" or "${ENV_PROD}"`,
            );
        }

        if (!webUrl) {
            throw new Error(
                `${environment === ENV_PROD ? "PROD_WEB_URL" : "LOCAL_WEB_URL"} is not set`,
            );
        }

        this.expressApp = express();

        // credentials: true is required for httpOnly cookies to be sent cross-origin.
        this.expressApp.use(cors({ origin: webUrl, credentials: true }));

        // Wrap Express in a raw http.Server so Socket.IO and Express share one port.
        this.httpServer = http.createServer(this.expressApp);

        // Attach Socket.IO to the shared http.Server with typed event generics.
        // path: '/socket' namespaces the upgrade request away from REST routes.
        // credentials: true lets Socket.IO include the JWT cookie in the handshake.
        this.io = new SocketIOServer<
            ClientToServerEvents,
            ServerToClientEvents
        >(this.httpServer, {
            cors: {
                origin: webUrl,
                methods: ["GET", "POST"],
                credentials: true,
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
