import { io } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "./types";

// Singleton typed Socket.IO client.
// autoConnect: false — useSocket hook controls when the connection is established.
export const socket = io<ServerToClientEvents, ClientToServerEvents>(
    import.meta.env.VITE_SERVER_URL,
    {
        path: "/socket",
        autoConnect: false,
    },
);
