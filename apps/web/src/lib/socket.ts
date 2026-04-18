import { io } from "socket.io-client";

// Single shared socket instance — created once and reused across the app.
// autoConnect is false so the connection is established explicitly when sync starts.
// withCredentials is required for the browser to send the authToken cookie on the handshake.
export const socket = io(import.meta.env.VITE_SERVER_URL, {
    autoConnect: false,
    withCredentials: true,
});
