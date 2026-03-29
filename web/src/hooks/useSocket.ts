import { useEffect } from "react";
import { socket } from "../lib/socket";
import { SOCKET_EVENTS } from "../lib/socketEvents";

const useSocket = () => {
    useEffect(() => {
        // Connection errors are async events, not thrown exceptions.
        socket.on(SOCKET_EVENTS.CONNECT_ERROR, (err) =>
            console.error("Socket connection error:", err),
        );
        socket.connect();

        return () => {
            socket.off(SOCKET_EVENTS.CONNECT_ERROR);
        };
    }, []);
};

export default useSocket;
