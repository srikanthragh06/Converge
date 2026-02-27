import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { socket } from "../socket";
import {
    SYNC_DOC,
    REPAIR_DOC,
    REPAIR_RESPONSE,
    REMOTE_ORIGIN,
    BATCH_MS,
} from "../constants";
import { mapsEqual } from "../utils";

// Wires the local Y.Doc to the server via Socket.IO.
// Handles batched outgoing updates, incoming sync, and the repair protocol.
const useSyncEditorChanges = (yDoc: Y.Doc) => {
    // Accumulate local Y.Doc updates between flushes
    const pendingUpdates = useRef<Uint8Array[]>([]);
    const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Merge and emit all pending updates to the server as a single batched update
    const flushPendingUpdates = () => {
        if (pendingUpdates.current.length === 0) return;
        const updates = pendingUpdates.current;
        pendingUpdates.current = [];
        const merged = Y.mergeUpdates(updates);
        socket.emit(SYNC_DOC, merged);
    };

    // Observe local Y.Doc changes — batch and send to server after BATCH_MS debounce.
    // Skips updates that originated remotely to prevent re-broadcasting.
    useEffect(() => {
        const onUpdate = (update: Uint8Array, origin: unknown) => {
            if (origin === REMOTE_ORIGIN) return;
            pendingUpdates.current.push(update);
            if (timeoutId.current) clearTimeout(timeoutId.current);
            timeoutId.current = setTimeout(flushPendingUpdates, BATCH_MS);
        };
        yDoc.on("update", onUpdate);
        return () => yDoc.off("update", onUpdate);
    }, [yDoc]);

    // Receive sync_doc from server — apply to local Y.Doc tagged as remote.
    // Decode SVs to Maps before and after to accurately detect a buffered op:
    // if the Maps are equal, Yjs couldn't apply the update (missing predecessor),
    // so we emit repair_doc to ask the server for what we're missing.
    useEffect(() => {
        const onSyncDoc = (update: Uint8Array) => {
            const svBefore = Y.decodeStateVector(Y.encodeStateVector(yDoc));
            Y.applyUpdate(yDoc, new Uint8Array(update), REMOTE_ORIGIN);
            const svAfter = Y.decodeStateVector(Y.encodeStateVector(yDoc));

            if (mapsEqual(svBefore, svAfter)) {
                socket.emit(REPAIR_DOC, Y.encodeStateVector(yDoc));
            }
        };
        socket.on(SYNC_DOC, onSyncDoc);
        return () => {
            socket.off(SYNC_DOC, onSyncDoc);
        };
    }, [yDoc]);

    // On connect (or reconnect), send our state vector so the server can diff and repair.
    // This bootstraps a new client with the full current doc state.
    useEffect(() => {
        const onConnect = () => {
            socket.emit(REPAIR_DOC, Y.encodeStateVector(yDoc));
        };
        socket.on("connect", onConnect);
        // If already connected when this hook mounts, fire immediately
        if (socket.connected) onConnect();
        return () => {
            socket.off("connect", onConnect);
        };
    }, [yDoc]);

    // Receive repair_doc from server — server detected it's behind and needs our state.
    // Compute and send back the diff from the server's SV to our current state.
    useEffect(() => {
        const onRepairDoc = (serverSV: Uint8Array) => {
            const diff = Y.encodeStateAsUpdate(yDoc, new Uint8Array(serverSV));
            socket.emit(REPAIR_RESPONSE, diff);
        };
        socket.on(REPAIR_DOC, onRepairDoc);
        return () => {
            socket.off(REPAIR_DOC, onRepairDoc);
        };
    }, [yDoc]);

    // Receive repair_response — apply the diff the server computed from our state vector
    useEffect(() => {
        const onRepairResponse = (diff: Uint8Array) => {
            Y.applyUpdate(yDoc, new Uint8Array(diff), REMOTE_ORIGIN);
        };
        socket.on(REPAIR_RESPONSE, onRepairResponse);
        return () => {
            socket.off(REPAIR_RESPONSE, onRepairResponse);
        };
    }, [yDoc]);
};

export default useSyncEditorChanges;
