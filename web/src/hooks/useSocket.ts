import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { socket } from "../sockets/socket";
import { isSocketConnectedAtom } from "../atoms/uiAtoms";

// Manages the socket connection lifecycle and tracks connected state in Jotai.
// Connects on mount and disconnects on unmount — keeps connection scoped to the component tree.
const useSocket = () => {
    const setIsConnected = useSetAtom(isSocketConnectedAtom);

    useEffect(() => {
        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        socket.connect();

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.disconnect();
        };
    }, []);
};

export default useSocket;
