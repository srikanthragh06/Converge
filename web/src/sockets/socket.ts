import { io, Socket } from "socket.io-client";
import { ServerToClientEvents, ClientToServerEvents } from "../types/types";
import { ENV_DEV, ENV_PROD } from "../constants/constants";

// Resolve which server to connect to based on environment.
// In prod, Traefik handles load balancing so there is one URL (VITE_SERVER_URL).
// In dev, the ?server=2 param selects the second replica for testing Redis pub/sub:
//   ?server=2  → VITE_SERVER_URL_2 (port 5001)
//   anything else → VITE_SERVER_URL_1 (port 5000)
// This read happens at module load time — if the param changes the user reloads anyway.
const environment: string | undefined = import.meta.env.VITE_ENVIRONMENT;

const params = new URLSearchParams(window.location.search);
let serverUrl: string | undefined = undefined;
if (environment === ENV_DEV) {
    serverUrl =
        params.get("server") === "2"
            ? import.meta.env.VITE_SERVER_URL_2
            : import.meta.env.VITE_SERVER_URL_1;
} else if (environment === ENV_PROD) {
    serverUrl = import.meta.env.VITE_SERVER_URL;
} else {
    console.error(
        `Unknown VITE_ENVIRONMENT "${environment}" — expected "${ENV_DEV}" or "${ENV_PROD}"`,
    );
}

// Singleton typed Socket.IO client.
// Type annotation on the variable (not the io() call) is the correct way to
// pass event generics — io() itself does not accept type arguments.
// autoConnect: false — useSocket hook controls when the connection is established.
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    serverUrl,
    {
        path: "/socket",
        autoConnect: false,
        withCredentials: true,
    },
);
