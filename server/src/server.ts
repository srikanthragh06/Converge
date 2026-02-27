import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import { ClientToServerEvents, ServerToClientEvents } from "./types";
import { handleDocSocketConnection } from "./sockets/socket";

// Express app handles REST routes (health check, future API endpoints).
export const expressApp = express();

// Wrap Express in a raw http.Server so Socket.IO and Express share one port.
export const server = http.createServer(expressApp);

// Only the Vite dev server is allowed to connect (browser origin).
const allowedOrigins = ["http://localhost:5173"];

expressApp.use(cors({ origin: allowedOrigins }));

// Attach Socket.IO to the shared http.Server with typed event generics.
// path: '/socket' namespaces the upgrade request away from any future REST routes.
export const socketServer = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents
>(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
    },
    path: "/socket",
});

// Register the document socket handler for every incoming connection
socketServer.on("connection", handleDocSocketConnection);
