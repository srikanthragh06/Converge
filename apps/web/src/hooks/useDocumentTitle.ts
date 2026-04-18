import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { isSocketConnectedAtom } from "../atoms/socket";
import { socketReceive } from "../lib/socket-receive.util";
import {
    SOCKET_EVENTS,
    SyncDocTitleAckSchema,
    SyncDocTitleClientSchema,
    SyncDocTitleServerSchema,
} from "@converge/shared";
import { socket } from "../lib/socket";
import { socketEmit } from "../lib/socket-emit.util";

/**
 * Manages document title state and sync. Exposes a debounced change handler
 * that emits title updates over the socket, listens for updates from other
 * clients, tracks pending ack state, and keeps the browser tab title in sync.
 */
const useDocumentTitle = () => {
    const isSocketConnected = useAtomValue(isSocketConnectedAtom); // read-only view of the global socket connection state

    const [title, setTitle] = useState<string>(""); // the document title, seeded from the initial fetch and kept in sync via socket
    const [isTitlePending, setIsTitlePending] = useState<boolean>(false); // true while a title change has been emitted but not yet acked by the server

    const titleTimeoutIdRef = useRef<number | null>(null); // debounce timer for outgoing title sync events
    const lastTitleChangeIdRef = useRef<string | null>(null); // changeId of the most recent title emit — used to match acks

    /**
     * Updates local title state and debounces a sync-doc-title-server emit so
     * the server and other clients stay in sync without a round-trip per keystroke.
     * @param newTitle - the updated title string from the input
     */
    const handleTitleChange = (newTitle: string) => {
        setTitle(newTitle);

        // Mark the title as pending immediately so the UI dims before the debounce fires.
        setIsTitlePending(true);

        if (!isSocketConnected) return;

        // Reset the debounce timer on every keystroke.
        if (titleTimeoutIdRef.current) clearTimeout(titleTimeoutIdRef.current);

        // After 300 ms of inactivity, emit the latest title with a fresh changeId.
        titleTimeoutIdRef.current = setTimeout(() => {
            const changeId = crypto.randomUUID();
            lastTitleChangeIdRef.current = changeId;
            socketEmit(
                socket,
                SOCKET_EVENTS.SYNC_DOC_TITLE_SERVER,
                SyncDocTitleServerSchema,
                { title: newTitle, changeId },
            );
            titleTimeoutIdRef.current = null;
        }, 300);
    };

    // Listens for title updates broadcast by the server from other clients and
    // updates local title state. Runs whenever the socket connection state changes.
    useEffect(() => {
        if (!isSocketConnected) return;

        /**
         * Applies a title update broadcast by the server from another client.
         * @param data - contains the new title string
         */
        const handleSyncDocTitleClient = (data: unknown) => {
            const res = socketReceive(SyncDocTitleClientSchema, data);
            if (!res) return;
            setTitle(res.title);
        };

        /**
         * Clears the pending indicator when the server acks the most recent title
         * emit. Ignores stale acks from earlier debounce flushes via changeId matching.
         * @param data - contains the changeId echoed back by the server
         */
        const handleSyncDocTitleAck = (data: unknown) => {
            const res = socketReceive(SyncDocTitleAckSchema, data);
            if (!res) return;
            // Only clear the pending state if the ack matches the latest emit.
            if (res.changeId === lastTitleChangeIdRef.current)
                setIsTitlePending(false);
        };

        socket.on(
            SOCKET_EVENTS.SYNC_DOC_TITLE_CLIENT,
            handleSyncDocTitleClient,
        );
        socket.on(SOCKET_EVENTS.SYNC_DOC_TITLE_ACK, handleSyncDocTitleAck);

        return () => {
            socket.off(
                SOCKET_EVENTS.SYNC_DOC_TITLE_CLIENT,
                handleSyncDocTitleClient,
            );
            socket.off(SOCKET_EVENTS.SYNC_DOC_TITLE_ACK, handleSyncDocTitleAck);
        };
    }, [isSocketConnected]);

    // Cleans up any pending title debounce timer on unmount.
    useEffect(() => {
        return () => {
            if (titleTimeoutIdRef.current)
                clearTimeout(titleTimeoutIdRef.current);
        };
    }, []);

    // Keeps the browser tab title in sync with the document title.
    // Resets to "Converge" on unmount so other pages don't inherit the document name.
    useEffect(() => {
        document.title = title ? `${title} — Converge` : "Converge";
        return () => {
            document.title = "Converge";
        };
    }, [title]);

    return { handleTitleChange, isTitlePending, setTitle, title };
};

export default useDocumentTitle;
