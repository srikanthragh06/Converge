import { BlockNoteEditor } from "@blocknote/core";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { socket } from "../lib/socket";
import { useAtomValue } from "jotai";
import { isSocketConnectedAtom } from "../atoms/socket";
import {
    mapsAreEqual,
    SyncDocClientSchema,
    SyncDocServerSchema,
    RepairSyncDocServerSchema,
    RepairSyncDocClientSchema,
    RepairSyncAckDocServerSchema,
    RepairSyncAckDocClientSchema,
    RepairAckDocServerSchema,
    RepairAckDocClientSchema,
    SOCKET_EVENTS,
    type GetDocumentResponseDto,
} from "@converge/shared";
import { socketEmit } from "../lib/socket-emit.util";
import { socketReceive } from "../lib/socket-receive.util";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "../lib/http";
import axios from "axios";
import useSocket from "./useSocket";

/**
 * Fetches the document by ID from the URL, initialises a BlockNote editor
 * backed by a shared Yjs document, and wires up Socket.io handlers for
 * real-time sync and periodic repair syncs.
 * Returns the editor instance and the current document fetch status.
 */
const useEditor = () => {
    const isSocketConnected = useAtomValue(isSocketConnectedAtom); // read-only view of the global socket connection state
    const { documentId } = useParams<{ documentId: string }>(); // document ID from the URL path
    const navigate = useNavigate();

    const [documentStatus, setDocumentStatus] = useState<
        "loading" | "ready" | "forbidden" | "notFound"
    >("loading"); // tracks the outcome of the document fetch

    const timeoutIdRef = useRef<number | null>(null); // stores the debounce timer ID for batching outgoing Yjs updates
    const pendingUpdatesRef = useRef<Uint8Array<ArrayBufferLike>[]>([]); // accumulates Yjs update chunks between debounce flushes

    const yDoc = useMemo(() => new Y.Doc(), []); // the shared Yjs document that backs the BlockNote editor state

    // the BlockNote editor instance; created once on mount with a stub collaboration config
    const editor = useMemo(() => {
        return BlockNoteEditor.create({
            // Stub collaboration config to wire up the Y.Doc fragment. Provider
            // and user identity will be replaced once the WebSocket sync provider
            // is connected.
            collaboration: {
                fragment: yDoc.getXmlFragment("blocknote"),
                provider: {},
                user: { name: "", color: "" },
            },
            // Override the default paste handler so that plain-text pastes are
            // interpreted as Markdown rather than inserted as a literal string.
            pasteHandler: ({ event, editor: e, defaultPasteHandler }) => {
                if (event.clipboardData?.types.includes("text/plain")) {
                    e.pasteMarkdown(event.clipboardData.getData("text/plain"));
                    return true;
                }

                return defaultPasteHandler();
            },
        });
    }, []);

    // Connect the socket only once the document is confirmed — prevents the gateway
    // from receiving a connection with an invalid or inaccessible document ID.
    useSocket(documentStatus === "ready");

    // Fetches the document on mount — sets status or navigates to /404 based on the error code.
    useEffect(() => {
        const fetchDocument = async () => {
            try {
                await apiClient.get<GetDocumentResponseDto>(
                    `/document/${documentId}`,
                );
                setDocumentStatus("ready");
            } catch (err) {
                if (axios.isAxiosError(err)) {
                    const statusCode = err.response?.status;
                    if (statusCode === 403) {
                        setDocumentStatus("forbidden");
                        return;
                    } else if (statusCode === 404) {
                        setDocumentStatus("notFound");
                        navigate("/404");
                        return;
                    }
                }
                // Treat all other errors (network failure, unexpected status, etc.) as not found.
                setDocumentStatus("notFound");
                navigate("/404");
            }
        };

        fetchDocument();
    }, [documentId]);

    // Listens for local Yjs updates and debounces them before emitting to the server.
    // Runs whenever the socket connection state changes.
    useEffect(() => {
        if (!isSocketConnected) return;

        /**
         * Called on every local Yjs update. Skips remote-origin updates to avoid
         * echo loops, then debounces and merges pending updates before emitting
         * them to the server along with the client state vector.
         * @param update - the encoded Yjs update bytes produced by the local change
         * @param origin - the origin tag; "REMOTE" updates are ignored
         */
        const handleNewUserUpdate = (
            update: Uint8Array<ArrayBufferLike>,
            origin: string,
        ) => {
            // ignore updates that originated remotely to prevent echo loops
            if (origin === "REMOTE") return;

            // queue the update and reset the debounce timer
            pendingUpdatesRef.current.push(update);
            if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);

            // after 300 ms of inactivity, merge all queued updates and emit once
            timeoutIdRef.current = setTimeout(() => {
                const mergedUpdate = Y.mergeUpdates(pendingUpdatesRef.current);
                pendingUpdatesRef.current = [];
                // include client SV so the server can detect any updates the client missed
                const clientSV = Y.encodeStateVector(yDoc);

                const updateArray = Array.from(mergedUpdate);
                const clientSVArray = Array.from(clientSV);
                socketEmit(
                    socket,
                    SOCKET_EVENTS.SYNC_DOC_SERVER,
                    SyncDocServerSchema,
                    {
                        updateArray,
                        clientSVArray,
                    },
                );
            }, 300);
        };

        yDoc.on("update", handleNewUserUpdate);

        return () => {
            yDoc.off("update", handleNewUserUpdate);
            if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
        };
    }, [yDoc, isSocketConnected]);

    // Manages the repair sync protocol: initiates a repair on connect and on a
    // 5-second heartbeat, and handles incoming repair-sync/ack events from the server.
    // Runs whenever the socket connection state changes.
    useEffect(() => {
        if (!isSocketConnected) return;

        /**
         * Sends the client's current state vector to the server to kick off a
         * repair sync, allowing the server to detect and send any missing updates.
         */
        const initiateRepairSync = () => {
            // snapshot the current client state vector to send to the server
            const clientSVArray = Array.from(Y.encodeStateVector(yDoc));
            // emit to the server so it can compute what the client is missing
            socketEmit(
                socket,
                SOCKET_EVENTS.REPAIR_SYNC_DOC_SERVER,
                RepairSyncDocServerSchema,
                {
                    clientSVArray,
                },
            );
        };

        /**
         * Responds to a server-initiated repair sync by computing the local diff
         * relative to the server's state vector and emitting it back with the client SV.
         * @param serverSV - the server's encoded state vector as a number array
         */
        // Handles repair initiated by the server — respond with our diff and SV.
        const handleRepairSyncDoc = (data: unknown) => {
            const res = socketReceive(RepairSyncDocClientSchema, data);
            if (!res) return;
            const serverSV = new Uint8Array(res.serverSVArray);
            const diffArray = Array.from(Y.encodeStateAsUpdate(yDoc, serverSV));
            const clientSVArray = Array.from(Y.encodeStateVector(yDoc));
            socketEmit(
                socket,
                SOCKET_EVENTS.REPAIR_SYNC_ACK_DOC_SERVER,
                RepairSyncAckDocServerSchema,
                {
                    diffArray,
                    clientSVArray,
                },
            );
        };

        /**
         * Applies the diff received from the other side, then computes and sends
         * back the diff the other side is missing based on their state vector.
         * @param diff - encoded Yjs update bytes from the other side
         * @param serverSV - the server's state vector used to compute the return diff
         */
        // Applies the diff sent by the other side, then sends back our diff.
        const handleRepairSyncAckDoc = (data: unknown) => {
            const res = socketReceive(RepairSyncAckDocClientSchema, data);
            if (!res) return;
            Y.applyUpdate(yDoc, new Uint8Array(res.diffArray), "REMOTE");
            const diffArray = Array.from(
                Y.encodeStateAsUpdate(yDoc, new Uint8Array(res.serverSVArray)),
            );
            const clientSVArray = Array.from(Y.encodeStateVector(yDoc));
            socketEmit(
                socket,
                SOCKET_EVENTS.REPAIR_ACK_DOC_SERVER,
                RepairAckDocServerSchema,
                {
                    diffArray,
                    clientSVArray,
                },
            );
        };

        /**
         * Applies the final diff sent by the server, completing the repair sync round.
         * @param diff - encoded Yjs update bytes representing the server's remaining delta
         */
        // Final step — applies any remaining diff the other side computed for us.
        const handleRepairAckDoc = (data: unknown) => {
            const res = socketReceive(RepairAckDocClientSchema, data);
            if (!res) return;
            Y.applyUpdate(yDoc, new Uint8Array(res.diffArray), "REMOTE");
        };

        socket.on(SOCKET_EVENTS.REPAIR_SYNC_DOC_CLIENT, handleRepairSyncDoc);
        socket.on(
            SOCKET_EVENTS.REPAIR_SYNC_ACK_DOC_CLIENT,
            handleRepairSyncAckDoc,
        );
        socket.on(SOCKET_EVENTS.REPAIR_ACK_DOC_CLIENT, handleRepairAckDoc);

        // Initiate repair on connect to pull any server state the client missed.
        initiateRepairSync();
        const heartbeatIntervalId = setInterval(initiateRepairSync, 5000);

        return () => {
            socket.off(
                SOCKET_EVENTS.REPAIR_SYNC_DOC_CLIENT,
                handleRepairSyncDoc,
            );
            socket.off(
                SOCKET_EVENTS.REPAIR_SYNC_ACK_DOC_CLIENT,
                handleRepairSyncAckDoc,
            );
            socket.off(SOCKET_EVENTS.REPAIR_ACK_DOC_CLIENT, handleRepairAckDoc);
            clearInterval(heartbeatIntervalId);
        };
    }, [yDoc, isSocketConnected]);

    // Listens for server-pushed sync-doc events and applies remote Yjs updates.
    // Triggers a repair sync if the state vectors diverge after applying the update.
    // Runs whenever the socket connection state changes.
    useEffect(() => {
        if (!isSocketConnected) return;

        /**
         * Applies a server-pushed Yjs update to the local doc. If the resulting
         * state vectors diverge, initiates a repair sync to reconcile the difference.
         * @param update - encoded Yjs update bytes from the server
         * @param serverSV - the server's state vector after applying the update
         */
        const handleSyncDocClient = (data: unknown) => {
            const res = socketReceive(SyncDocClientSchema, data);
            if (!res) return;
            const { updateArray, serverSVArray } = res;

            const update = new Uint8Array(updateArray);
            const serverSV = new Uint8Array(serverSVArray);

            // apply the server update to the local doc, tagged as REMOTE to avoid re-emitting it
            Y.applyUpdate(yDoc, update, "REMOTE");

            // capture the client state vector after the update to compare against the server's
            const clientSV = Y.encodeStateVector(yDoc);

            // if state vectors differ, the client is still missing some updates — trigger a repair
            if (
                !mapsAreEqual(
                    Y.decodeStateVector(serverSV),
                    Y.decodeStateVector(clientSV),
                )
            ) {
                socketEmit(
                    socket,
                    SOCKET_EVENTS.REPAIR_SYNC_DOC_SERVER,
                    RepairSyncDocServerSchema,
                    {
                        clientSVArray: Array.from(clientSV),
                    },
                );
            }
        };

        socket.on(SOCKET_EVENTS.SYNC_DOC_CLIENT, handleSyncDocClient);

        return () => {
            socket.off(SOCKET_EVENTS.SYNC_DOC_CLIENT, handleSyncDocClient);
        };
    }, [yDoc, isSocketConnected]);

    return { editor, documentStatus };
};

export default useEditor;
