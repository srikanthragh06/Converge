// Measures round-trip latency by periodically sending socket_ping with a timestamp
// and reading the echoed timestamp back from socket_pong to compute RTT.
// socket is a module-level singleton so it is stable across renders — no dep needed.
import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { socket } from "../sockets/socket";
import { SOCKET_PING, SOCKET_PONG, PING_INTERVAL_MS } from "../constants/constants";
import { pingMsAtom } from "../atoms/uiAtoms";

const usePing = () => {
    const setPingMs = useSetAtom(pingMsAtom);

    useEffect(() => {
        // Receive the echoed timestamp and compute RTT
        const onPong = (ts: number) => {
            setPingMs(Date.now() - ts);
        };
        socket.on(SOCKET_PONG, onPong);

        // Fire a ping probe immediately (if connected), then repeat every PING_INTERVAL_MS
        const sendPing = () => {
            if (socket.connected) socket.emit(SOCKET_PING, Date.now());
        };
        sendPing();
        const id = setInterval(sendPing, PING_INTERVAL_MS);

        return () => {
            socket.off(SOCKET_PONG, onPong);
            clearInterval(id);
        };
    }, []);
};

export default usePing;
