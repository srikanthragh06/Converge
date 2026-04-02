import { BlockNoteEditor } from "@blocknote/core";
import { useEffect, useMemo, useRef } from "react";
import * as Y from "yjs";
import { socket } from "../lib/socket";
import { useAtomValue } from "jotai";
import { isSocketConnectedAtom } from "../atoms/atoms";
import {
    mapsAreEqual,
    SyncDocClientSchema,
    SyncDocServerSchema,
} from "@converge/shared";
import { socketEmit } from "../lib/socket-emit.util";
import { socketReceive } from "../lib/socket-receive.util";

/**
 * Initialises a BlockNote editor backed by a shared Yjs document and wires
 * up Socket.io handlers for real-time sync and periodic repair syncs.
 * Returns the editor instance for use in a React component.
 */
const useEditor = () => {
    const isSocketConnected = useAtomValue(isSocketConnectedAtom); // read-only view of the global socket connection state

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
                socketEmit(socket, "sync-doc-server", SyncDocServerSchema, {
                    updateArray,
                    clientSVArray,
                });
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
            const clientSV = Y.encodeStateVector(yDoc);
            // emit to the server so it can compute what the client is missing
            socket.emit("repair-sync-doc-server", {
                clientSV: Array.from(clientSV),
            });
        };

        /**
         * Responds to a server-initiated repair sync by computing the local diff
         * relative to the server's state vector and emitting it back with the client SV.
         * @param serverSV - the server's encoded state vector as a number array
         */
        // Handles repair initiated by the server — respond with our diff and SV.
        const handleRepairSyncDoc = ({ serverSV }: { serverSV: number[] }) => {
            // convert the server SV from transport format to a typed byte array
            const serverSVBytes = new Uint8Array(serverSV);
            // compute the updates the server is missing relative to its state vector
            const diff = Y.encodeStateAsUpdate(yDoc, serverSVBytes);
            // snapshot client SV so the server can compute what we're missing in return
            const clientSV = Y.encodeStateVector(yDoc);
            socket.emit("repair-sync-ack-doc-server", {
                diff: Array.from(diff),
                clientSV: Array.from(clientSV),
            });
        };

        /**
         * Applies the diff received from the other side, then computes and sends
         * back the diff the other side is missing based on their state vector.
         * @param diff - encoded Yjs update bytes from the other side
         * @param serverSV - the server's state vector used to compute the return diff
         */
        // Applies the diff sent by the other side, then sends back our diff.
        const handleRepairSyncAckDoc = ({
            diff,
            serverSV,
        }: {
            diff: number[];
            serverSV: number[];
        }) => {
            // apply the diff we received from the other side to bring our doc up to date
            Y.applyUpdate(yDoc, new Uint8Array(diff), "REMOTE");
            // compute what the server is still missing based on its state vector
            const diffForServer = Y.encodeStateAsUpdate(
                yDoc,
                new Uint8Array(serverSV),
            );
            // snapshot our updated SV so the server can detect any remaining gaps
            const clientSV = Y.encodeStateVector(yDoc);
            socket.emit("repair-ack-doc-server", {
                diff: Array.from(diffForServer),
                clientSV: Array.from(clientSV),
            });
        };

        /**
         * Applies the final diff sent by the server, completing the repair sync round.
         * @param diff - encoded Yjs update bytes representing the server's remaining delta
         */
        // Final step — applies any remaining diff the other side computed for us.
        const handleRepairAckDoc = ({ diff }: { diff: number[] }) => {
            Y.applyUpdate(yDoc, new Uint8Array(diff), "REMOTE");
        };

        socket.on("repair-sync-doc-client", handleRepairSyncDoc);
        socket.on("repair-sync-ack-doc-client", handleRepairSyncAckDoc);
        socket.on("repair-ack-doc-client", handleRepairAckDoc);

        // Initiate repair on connect to pull any server state the client missed.
        initiateRepairSync();
        const heartbeatIntervalId = setInterval(initiateRepairSync, 5000);

        return () => {
            socket.off("repair-sync-doc-client", handleRepairSyncDoc);
            socket.off("repair-sync-ack-doc-client", handleRepairSyncAckDoc);
            socket.off("repair-ack-doc-client", handleRepairAckDoc);
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
                socket.emit("repair-sync-doc-server", {
                    clientSV: Array.from(clientSV),
                });
            }
        };

        socket.on("sync-doc-client", handleSyncDocClient);

        return () => {
            socket.off("sync-doc-client", handleSyncDocClient);
        };
    }, [yDoc, isSocketConnected]);

    return { editor };
};

export default useEditor;
