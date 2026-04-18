import { useEffect } from "react";
import { socket } from "../lib/socket";
import { SOCKET_EVENTS } from "@converge/shared";
import { PING_INTERVAL_MS } from "../constants/constants";
import { useAtom } from "jotai";
import { isSocketConnectedAtom } from "../atoms/socket";
import { PingSchema, PongSchema } from "@converge/shared";
import { socketReceive } from "../lib/socket-receive.util";
import { socketEmit } from "../lib/socket-emit.util";

/**
 * Manages the Socket.io connection lifecycle and ping-pong latency checks.
 * Connects when canConnect is true, disconnects when false. Registers
 * connect/disconnect/error listeners and periodically emits pings to
 * measure round-trip latency while connected.
 *
 * @param canConnect - When false the socket is disconnected; defaults to true.
 */
// Flow: connect → start ping interval → stop pings on disconnect.
const useSocket = (canConnect: boolean = true) => {
    const [isSocketConnected, setIsSocketConnected] = useAtom(
        isSocketConnectedAtom,
    ); // mirrors the global atom — true while the socket is open

    // Registers event listeners then connects or disconnects based on canConnect.
    useEffect(() => {
        // Connection errors are async events, not thrown exceptions.
        socket.on(SOCKET_EVENTS.CONNECT, () => {
            setIsSocketConnected(true);
        });

        socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
            console.log(`Socket disconnected because \n${reason}`);
            setIsSocketConnected(false);
        });

        socket.on(SOCKET_EVENTS.CONNECT_ERROR, (err) => {
            console.error("Socket connection error:", err);
            setIsSocketConnected(false);
        });

        if (canConnect) socket.connect();
        else socket.disconnect();

        return () => {
            socket.off(SOCKET_EVENTS.CONNECT);
            socket.off(SOCKET_EVENTS.CONNECT_ERROR);
            socket.off(SOCKET_EVENTS.DISCONNECT);
            setIsSocketConnected(false);
        };
    }, [canConnect]);

    // Starts pings on connect, stops on disconnect.
    useEffect(() => {
        if (!isSocketConnected) return;

        // Maps pingId → timestamp so latency can be calculated when pong arrives.
        const pingMap = new Map<string, number>();

        /**
         * Emits a ping event with a unique ID and records the send timestamp
         * so that round-trip latency can be measured when the pong arrives.
         */
        const sendPing = () => {
            const newPingId = crypto.randomUUID();
            pingMap.set(newPingId, Date.now());
            socketEmit(socket, SOCKET_EVENTS.PING, PingSchema, {
                pingId: newPingId,
            });
        };

        socket.on(SOCKET_EVENTS.PONG, (data) => {
            const res = socketReceive(PongSchema, data);
            if (!res) return;
            const { pingId } = res;
            const pingTime = pingMap.get(pingId);
            if (pingTime) {
                pingMap.delete(pingId);
            }
        });

        // Send immediately rather than waiting for the first interval tick.
        const interval = setInterval(sendPing, PING_INTERVAL_MS);
        sendPing();

        return () => {
            clearInterval(interval);
            socket.off(SOCKET_EVENTS.PONG);
        };
    }, [isSocketConnected]);

    useEffect(() => {
        if (!isSocketConnected) return;

        socket.on("error", (error: string) => {
            console.error(error);
        });

        return () => {
            socket.off("error");
        };
    }, [isSocketConnected]);
};

export default useSocket;
