// Measures round-trip latency by periodically sending socket_ping with a timestamp
// and reading the echoed timestamp back from socket_pong to compute RTT.
// socket is a module-level singleton so it is stable across renders — no dep needed.
import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { socket } from "../sockets/socket";
import {
    SOCKET_PING,
    SOCKET_PONG,
    PING_INTERVAL_MS,
} from "../constants/constants";
import { isSocketConnectedAtom, pingMsAtom } from "../atoms/uiAtoms";

const usePing = () => {
    const setPingMs = useSetAtom(pingMsAtom);
    const isConnected = useAtomValue(isSocketConnectedAtom);

    // Register the pong listener once on mount
    useEffect(() => {
        const onPong = (ts: number) => {
            setPingMs(Date.now() - ts);
        };
        socket.on(SOCKET_PONG, onPong);

        return () => {
            socket.off(SOCKET_PONG, onPong);
        };
    }, []);

    // Re-fires whenever isConnected changes.
    // When disconnected, clears the stale ping value so the UI shows no data.
    // When connected, sends an immediate probe then sets up the recurring interval
    // so the first ping goes out right away rather than waiting for the first tick.
    useEffect(() => {
        if (!isConnected) {
            setPingMs(null);
            return;
        }

        const sendPing = () => socket.emit(SOCKET_PING, Date.now());
        sendPing();
        const id = setInterval(sendPing, PING_INTERVAL_MS);

        return () => clearInterval(id);
    }, [isConnected]);
};

export default usePing;
