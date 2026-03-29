import { useEffect } from "react";
import { socket } from "../lib/socket";
import { SOCKET_EVENTS } from "../lib/socketEvents";
import { PING_INTERVAL_MS } from "../constants/constants";
import { useAtom } from "jotai";
import { isSocketConnectedAtom } from "../atoms/atoms";

// Flow: connect → start ping interval → stop pings on disconnect.
const useSocket = () => {
    const [isSocketConnected, setIsSocketConnected] = useAtom(
        isSocketConnectedAtom,
    );

    // Registers listeners before connect() so no events are missed.
    useEffect(() => {
        // Connection errors are async events, not thrown exceptions.
        socket.on(SOCKET_EVENTS.CONNECT, () => {
            setIsSocketConnected(true);
        });

        socket.on(SOCKET_EVENTS.CONNECT_ERROR, (err) => {
            console.error("Socket connection error:", err);
            setIsSocketConnected(false);
        });

        socket.connect();

        return () => {
            socket.off(SOCKET_EVENTS.CONNECT);
            socket.off(SOCKET_EVENTS.CONNECT_ERROR);
            setIsSocketConnected(false);
        };
    }, []);

    // Starts pings on connect, stops on disconnect.
    useEffect(() => {
        if (!isSocketConnected) return;

        // Maps pingId → timestamp so latency can be calculated when pong arrives.
        const pingMap = new Map<string, number>();

        const sendPing = () => {
            const newPingId = crypto.randomUUID();
            pingMap.set(newPingId, Date.now());
            socket.emit(SOCKET_EVENTS.PING, { pingId: newPingId });
        };

        socket.on(
            SOCKET_EVENTS.PONG,
            ({ data: { pingId } }: { data: { pingId: string } }) => {
                const pingTime = pingMap.get(pingId);
                if (pingTime) {
                    pingMap.delete(pingId);
                }
            },
        );

        // Send immediately rather than waiting for the first interval tick.
        const interval = setInterval(sendPing, PING_INTERVAL_MS);
        sendPing();

        return () => {
            clearInterval(interval);
            socket.off(SOCKET_EVENTS.PONG);
        };
    }, [isSocketConnected]);
};

export default useSocket;
