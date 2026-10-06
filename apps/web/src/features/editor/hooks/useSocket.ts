import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { socket } from "@/lib/socket";
import {
    AccessChangedSchema,
    SOCKET_EVENTS,
    type GetDocumentResponseDto,
} from "@converge/shared";
import { useSetAtom } from "jotai";
import { socketReadyDocumentIdAtom } from "@/atoms/socket";
import { documentKeys } from "@/features/documents/queryKeys";
import { socketReceive } from "@/lib/socket-receive.util";

/**
 * Manages the Socket.io connection lifecycle.
 * Connects when canConnect is true, disconnects when false. Sets
 * socketReadyDocumentIdAtom to the document only when the server emits
 * DOC_READY, guaranteeing that handleConnection has fully completed before
 * any sync operations begin, and clears it on disconnect.
 * DOC_READY also refreshes the document lists, since the server records
 * the visit just before sending it and Recent, Library and ⌘K are ordered
 * by last visit. ACCESS_CHANGED writes the user's new access level into the
 * cached document, so everything reading it (the editor's editability, the
 * header's access badge) updates in place.
 *
 * @param canConnect - When false the socket is disconnected; defaults to true.
 * @param documentId - Stamped onto the socket query so the gateway can identify the document.
 */
const useSocket = (canConnect: boolean = true, documentId?: number) => {
    const setSocketReadyDocumentId = useSetAtom(socketReadyDocumentIdAtom); // set only after DOC_READY is received, not merely when the transport connects
    const queryClient = useQueryClient();

    // Registers event listeners then connects or disconnects based on canConnect. Re-runs when documentId changes to reconnect to the new document's room.
    useEffect(() => {
        socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
            console.log(`Socket disconnected because \n${reason}`);
            setSocketReadyDocumentId(null);
        });

        socket.on(SOCKET_EVENTS.CONNECT_ERROR, (err) => {
            console.error("Socket connection error:", err);
            setSocketReadyDocumentId(null);
        });

        socket.on(SOCKET_EVENTS.DOC_READY, () => {
            setSocketReadyDocumentId(documentId ?? null);
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        });

        socket.on(SOCKET_EVENTS.ACCESS_CHANGED, (data: unknown) => {
            const res = socketReceive(AccessChangedSchema, data);
            if (!res || documentId === undefined) return;
            queryClient.setQueryData<GetDocumentResponseDto>(
                documentKeys.detail(documentId),
                (doc) => doc && { ...doc, resolvedAccess: res.accessLevel },
            );
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
            socket.off(SOCKET_EVENTS.ACCESS_CHANGED);
            socket.off("error");
            setSocketReadyDocumentId(null);
            socket.disconnect();
        };
    }, [canConnect, documentId, queryClient]);
};

export default useSocket;
