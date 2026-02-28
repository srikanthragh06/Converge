import { io } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "./types";

// Resolve which server to connect to based on the ?server query param.
// ?server=2  → VITE_SERVER_URL_2 (server instance on port 5001)
// anything else (including no param) → VITE_SERVER_URL_1 (port 5000)
// This read happens at module load time — if the param changes the user reloads anyway.
const params = new URLSearchParams(window.location.search);
const serverUrl =
    params.get("server") === "2"
        ? import.meta.env.VITE_SERVER_URL_2
        : import.meta.env.VITE_SERVER_URL_1;

// Singleton typed Socket.IO client.
// autoConnect: false — useSocket hook controls when the connection is established.
export const socket = io<ServerToClientEvents, ClientToServerEvents>(serverUrl, {
    path: "/socket",
    autoConnect: false,
});
