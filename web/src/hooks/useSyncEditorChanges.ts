import { useEffect, useRef, useState } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { socket } from "../sockets/socket";
import {
    SYNC_DOC,
    REPAIR_DOC,
    REPAIR_RESPONSE,
    REMOTE_ORIGIN,
    BATCH_MS,
    HEARTBEAT_SYNC,
    HEARTBEAT_SYNCACK,
    HEARTBEAT_ACK,
    HEARTBEAT_INTERVAL_MS,
} from "../constants/constants";
import { mapsEqual } from "../utils/utils";
import {
    isApplyingUpdatesAtom,
    isRestoringSyncAtom,
    isSocketConnectedAtom,
} from "../atoms/uiAtoms";

// Wires the local Y.Doc to the server via Socket.IO.
// Handles batched outgoing updates, incoming sync, and the repair protocol.
// Also drives the isRestoringSyncAtom and isApplyingUpdatesAtom UI status indicators.
// Persists all Y.Doc changes to IndexedDB via y-indexeddb so edits survive offline periods.
const useSyncEditorChanges = (yDoc: Y.Doc) => {
    // Accumulate local Y.Doc updates between flushes
    const pendingUpdates = useRef<Uint8Array[]>([]);
    const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Auto-clear timers for the status indicators — reset on each new trigger
    const restoringTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
    const applyingTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
    // True once y-indexeddb has applied the local IndexedDB snapshot to the Y.Doc.
    // Gates the initial repair_doc so we send an accurate SV with all offline edits included.
    const [isIndexedDBSynced, setIsIndexedDBSynced] = useState(false);
    // IndexedDB document key — single-doc scope for now
    const INDEXEDDB_DOC_NAME = "1";

    // useSetAtom avoids subscribing this hook to atom value changes (no extra re-renders)
    const setIsRestoring = useSetAtom(isRestoringSyncAtom);
    const setIsApplying = useSetAtom(isApplyingUpdatesAtom);
    const isSocketConnected = useAtomValue(isSocketConnectedAtom);

    // Minimum time (ms) each status indicator stays visible, even if the underlying
    // operation completes faster. Resets the timer whenever called again.
    const RESTORING_DISPLAY_MS = 1200;
    const APPLYING_DISPLAY_MS = 1200;

    // Helper: show "Restoring sync" for at least RESTORING_DISPLAY_MS then auto-clear.
    // Calling again while the timer is active resets it, keeping the indicator visible.
    const flashRestoring = () => {
        setIsRestoring(true);
        if (restoringTimerId.current) clearTimeout(restoringTimerId.current);
        restoringTimerId.current = setTimeout(
            () => setIsRestoring(false),
            RESTORING_DISPLAY_MS,
        );
    };

    // Helper: show "Applying updates" for at least APPLYING_DISPLAY_MS then auto-clear.
    // Resets the timer if called again before the previous one expires.
    const flashApplying = () => {
        setIsApplying(true);
        if (applyingTimerId.current) clearTimeout(applyingTimerId.current);
        applyingTimerId.current = setTimeout(
            () => setIsApplying(false),
            APPLYING_DISPLAY_MS,
        );
    };

    // Set up IndexedDB persistence for the Y.Doc.
    // On mount, loads locally stored state from IndexedDB into the doc before server sync.
    // y-indexeddb automatically observes all future Y.Doc updates and persists them —
    // no manual write calls needed. isIndexedDBSynced flips to true once ready.
    useEffect(() => {
        const persistence = new IndexeddbPersistence(INDEXEDDB_DOC_NAME, yDoc);
        persistence.on("synced", () => {
            setIsIndexedDBSynced(true);
        });
        return () => {
            persistence.destroy();
        };
    }, [yDoc]);

    // Merge and emit all pending updates to the server as a single batched update
    const flushPendingUpdates = () => {
        if (pendingUpdates.current.length === 0) return;
        const updates = pendingUpdates.current;
        pendingUpdates.current = [];
        const merged = Y.mergeUpdates(updates);
        // Piggyback the client's current SV so the server can compare and detect divergence
        socket.emit(SYNC_DOC, merged, Y.encodeStateVector(yDoc));
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
    // Server piggybacks its current SV on every relay. After applying, compare
    // client SV against serverSV: any divergence means one side has ops the other
    // is missing, so emit repair_doc to trigger the server to send what we lack.
    useEffect(() => {
        const onSyncDoc = (update: Uint8Array, serverSV: Uint8Array) => {
            // Show "Applying updates" while this remote change lands in the editor
            flashApplying();

            Y.applyUpdate(yDoc, new Uint8Array(update), REMOTE_ORIGIN);

            const clientSVMap = Y.decodeStateVector(Y.encodeStateVector(yDoc));
            const serverSVMap = Y.decodeStateVector(new Uint8Array(serverSV));

            if (!mapsEqual(clientSVMap, serverSVMap)) {
                // SV mismatch — kick off a repair cycle
                flashRestoring();
                socket.emit(REPAIR_DOC, Y.encodeStateVector(yDoc));
            }
        };
        socket.on(SYNC_DOC, onSyncDoc);
        return () => {
            socket.off(SYNC_DOC, onSyncDoc);
        };
    }, [yDoc]);

    // On connect (or reconnect), send our state vector so the server can diff and repair.
    // Guards on both isIndexedDBSynced and isSocketConnected — if the local IndexedDB
    // snapshot hasn't been applied yet, return early so we don't send a stale SV.
    // When isIndexedDBSynced flips to true this effect re-runs (it's in the dep array)
    // and onConnect() is called directly to fire repair_doc with the correct SV,
    // including any offline edits made while disconnected.
    useEffect(() => {
        const onConnect = () => {
            if (!isIndexedDBSynced) return;
            if (!isSocketConnected) return;
            // Initial repair_doc is the start of a restore cycle
            flashRestoring();
            socket.emit(REPAIR_DOC, Y.encodeStateVector(yDoc));
        };
        socket.on("connect", onConnect);
        onConnect();
        return () => {
            socket.off("connect", onConnect);
        };
    }, [yDoc, isIndexedDBSynced, isSocketConnected]);

    // Receive repair_doc from server — server detected it's behind and needs our state.
    // Compute and send back the diff from the server's SV to our current state.
    useEffect(() => {
        const onRepairDoc = (serverSV: Uint8Array) => {
            // Server requested our state — we are in a restore cycle
            flashRestoring();
            const diff = Y.encodeStateAsUpdate(yDoc, new Uint8Array(serverSV));
            socket.emit(REPAIR_RESPONSE, diff);
        };
        socket.on(REPAIR_DOC, onRepairDoc);
        return () => {
            socket.off(REPAIR_DOC, onRepairDoc);
        };
    }, [yDoc]);

    // Receive repair_response — apply the diff the server computed from our state vector.
    // Restoring clears itself via its own timer; briefly flash "Applying updates" instead.
    useEffect(() => {
        const onRepairResponse = (diff: Uint8Array) => {
            flashApplying();
            Y.applyUpdate(yDoc, new Uint8Array(diff), REMOTE_ORIGIN);
        };
        socket.on(REPAIR_RESPONSE, onRepairResponse);
        return () => {
            socket.off(REPAIR_RESPONSE, onRepairResponse);
        };
    }, [yDoc]);

    // Heartbeat: every HEARTBEAT_INTERVAL_MS emit our SV so the server can diff.
    // Only fires while connected; the interval is cleared on unmount.
    useEffect(() => {
        const id = setInterval(() => {
            if (!isSocketConnected) return;
            // Heartbeat starts a restore cycle — auto-clears after RESTORING_DISPLAY_MS
            flashRestoring();
            socket.emit(HEARTBEAT_SYNC, Y.encodeStateVector(yDoc));
        }, HEARTBEAT_INTERVAL_MS);
        return () => clearInterval(id);
    }, [yDoc, isSocketConnected]);

    // heartbeat_syncack: server sends what we're missing plus its own SV.
    // Apply the diff, then send back what the server is missing.
    useEffect(() => {
        const onSyncAck = (diff: Uint8Array, serverSV: Uint8Array) => {
            Y.applyUpdate(yDoc, new Uint8Array(diff), REMOTE_ORIGIN);
            // Compute what the server is missing relative to our (now updated) state
            const diffForServer = Y.encodeStateAsUpdate(
                yDoc,
                new Uint8Array(serverSV),
            );
            socket.emit(HEARTBEAT_ACK, diffForServer);
        };
        socket.on(HEARTBEAT_SYNCACK, onSyncAck);
        return () => {
            socket.off(HEARTBEAT_SYNCACK, onSyncAck);
        };
    }, [yDoc]);
};

export default useSyncEditorChanges;
