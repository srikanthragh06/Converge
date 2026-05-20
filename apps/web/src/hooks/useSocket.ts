import { useEffect } from "react";
import { socket } from "../lib/socket";
import { SOCKET_EVENTS } from "@converge/shared";
import { useSetAtom } from "jotai";
import { isSocketReadyAtom } from "../atoms/socket";

/**
 * Manages the Socket.io connection lifecycle.
 * Connects when canConnect is true, disconnects when false. Sets
 * isSocketReady only when the server emits DOC_READY, guaranteeing that
 * handleConnection has fully completed before any sync operations begin.
 *
 * @param canConnect - When false the socket is disconnected; defaults to true.
 * @param documentId - Stamped onto the socket query so the gateway can identify the document.
 */
const useSocket = (canConnect: boolean = true, documentId?: string) => {
    const setIsSocketReady = useSetAtom(isSocketReadyAtom); // true only after DOC_READY is received, not merely when the transport connects

    // Registers event listeners then connects or disconnects based on canConnect. Re-runs when documentId changes to reconnect to the new document's room.
    useEffect(() => {
        socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
            console.log(`Socket disconnected because \n${reason}`);
            setIsSocketReady(false);
        });

        socket.on(SOCKET_EVENTS.CONNECT_ERROR, (err) => {
            console.error("Socket connection error:", err);
            setIsSocketReady(false);
        });

        socket.on(SOCKET_EVENTS.DOC_READY, () => {
            setIsSocketReady(true);
        });

        socket.on("error", (error: string) => {
            console.error(error);
        });

        if (canConnect) {
            // Set the documentId query param before connecting so the gateway
            // can read it from the handshake without trusting subsequent messages.
            socket.io.opts.query = { documentId };
            socket.connect();
        } else socket.disconnect();

        return () => {
            socket.off(SOCKET_EVENTS.CONNECT_ERROR);
            socket.off(SOCKET_EVENTS.DISCONNECT);
            socket.off(SOCKET_EVENTS.DOC_READY);
            socket.off("error");
            setIsSocketReady(false);
            socket.disconnect();
        };
    }, [canConnect, documentId]);
};

export default useSocket;
