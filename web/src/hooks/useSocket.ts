import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { socket } from "../sockets/socket";
import { isAuthedAtom, isSocketConnectedAtom } from "../atoms/uiAtoms";

// Manages the socket connection lifecycle and tracks connected state in Jotai.
// Only connects once the user is authenticated (isAuthedAtom = true).
// Disconnects on unmount or when auth is revoked.
const useSocket = () => {
    const isAuthed = useAtomValue(isAuthedAtom);
    const setIsConnected = useSetAtom(isSocketConnectedAtom);

    useEffect(() => {
        // Do not attempt to connect until auth is confirmed.
        if (!isAuthed) return;

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
    }, [isAuthed]);
};

export default useSocket;
