import { useEffect } from "react";
import { socket } from "../socket";

// Manages the socket connection lifecycle.
// Connects on mount and disconnects on unmount — keeps connection scoped to the component tree.
const useSocket = () => {
    useEffect(() => {
        socket.connect();
        return () => {
            socket.disconnect();
        };
    }, []);
};

export default useSocket;
