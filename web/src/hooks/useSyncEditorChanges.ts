import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom, useAtomValue } from "jotai";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { socket } from "../sockets/socket";
import { axiosClient } from "../lib/axiosClient";
import { ApiResponse, DocumentMetaData } from "../types/api";
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
    SYNC_TITLE,
} from "../constants/constants";
import { mapsEqual } from "../utils/utils";
import {
    isApplyingUpdatesAtom,
    isRestoringSyncAtom,
    isSocketConnectedAtom,
} from "../atoms/uiAtoms";

// Wires the local Y.Doc to the server via Socket.IO.
// Handles batched outgoing updates, incoming sync, and the repair protocol.
// Manages the doc join lifecycle: emits join_doc on socket connect, listens for
// joined_doc to gate all sync operations, and emits leave_doc on cleanup.
// IndexedDB persistence via y-indexeddb ensures offline edits survive disconnects.
// Returns { title } — the document title fetched from the server on each join.
const useSyncEditorChanges = (yDoc: Y.Doc, documentId: number) => {
    const navigate = useNavigate();
    // Accumulate local Y.Doc updates between flushes
    const pendingUpdates = useRef<Uint8Array[]>([]);
    const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Auto-clear timers for the status indicators — reset on each new trigger
    const restoringTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
    const applyingTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
    // True once y-indexeddb has applied the local IndexedDB snapshot to the Y.Doc.
    // Gates the initial repair_doc so we send an accurate SV with all offline edits included.
    const [isIndexedDBSynced, setIsIndexedDBSynced] = useState(false);
    // True once the server confirms joined_doc — gates all sync events so no
    // sync traffic flows before the server has loaded the right Y.Doc for this room.
    const [isDocJoined, setIsDocJoined] = useState(false);
    // Document title fetched from the server on each joined_doc. Empty until loaded.
    const [title, setTitle] = useState("");
    // Briefly true when a remote sync_title arrives — drives the dim effect in DocumentTitle.
    const [isTitleSyncing, setIsTitleSyncing] = useState(false);

    // useSetAtom avoids subscribing this hook to atom value changes (no extra re-renders)
    const setIsRestoring = useSetAtom(isRestoringSyncAtom);
    const setIsApplying = useSetAtom(isApplyingUpdatesAtom);
    const isSocketConnected = useAtomValue(isSocketConnectedAtom);

    // Minimum time (ms) each status indicator stays visible, even if the underlying
    // operation completes faster. Resets the timer whenever called again.
    const RESTORING_DISPLAY_MS = 1200;
    const APPLYING_DISPLAY_MS = 1200;

    // Helper: show "Restoring sync" for at least RESTORING_DISPLAY_MS then auto-clear.
    const flashRestoring = () => {
        setIsRestoring(true);
        if (restoringTimerId.current) clearTimeout(restoringTimerId.current);
        restoringTimerId.current = setTimeout(
            () => setIsRestoring(false),
            RESTORING_DISPLAY_MS,
        );
    };

    // Helper: show "Applying updates" for at least APPLYING_DISPLAY_MS then auto-clear.
    const flashApplying = () => {
        setIsApplying(true);
        if (applyingTimerId.current) clearTimeout(applyingTimerId.current);
        applyingTimerId.current = setTimeout(
            () => setIsApplying(false),
            APPLYING_DISPLAY_MS,
        );
    };

    // Set up IndexedDB persistence scoped to this document.
    // Loads the local snapshot into the Y.Doc on mount before any server sync fires.
    // y-indexeddb automatically persists all future Y.Doc updates — no manual writes needed.
    useEffect(() => {
        const persistence = new IndexeddbPersistence(String(documentId), yDoc);
        persistence.on("synced", () => {
            setIsIndexedDBSynced(true);
        });
        return () => {
            persistence.destroy();
        };
    }, [yDoc]);

    // Doc join lifecycle: emit join_doc on connect; listen for joined_doc/left_doc/disconnect
    // to keep isDocJoined accurate. Emits leave_doc on cleanup so the server clears its state.
    // If isSocketConnected is true when this effect runs, fire join_doc immediately.
    useEffect(() => {
        const onConnect = () => socket.emit("join_doc", documentId);
        const onJoinedDoc = async () => {
            setIsDocJoined(true);
            // Fetch the current title from the server now that the doc row is guaranteed to exist.
            try {
                const res = await axiosClient.get<
                    ApiResponse<DocumentMetaData>
                >(`/documents/${documentId}`);
                if (res.data.success) setTitle(res.data.data.title);
            } catch (err) {
                console.error("Failed to fetch document title:", err);
            }
        };
        const onLeftOrDisconnect = () => {
            setIsDocJoined(false);
        };
        const onJoinDocError = (reason: string) => {
            console.warn(`join_doc_error for doc ${documentId}: ${reason}`);
            setIsDocJoined(false);
        };
        const onDocNotFound = () => {
            // Server confirmed the document does not exist — navigate to the 404 page.
            navigate("/not-found");
        };

        socket.on("connect", onConnect);
        socket.on("joined_doc", onJoinedDoc);
        socket.on("join_doc_error", onJoinDocError);
        socket.on("doc_not_found", onDocNotFound);
        socket.on("left_doc", onLeftOrDisconnect);
        socket.on("disconnect", onLeftOrDisconnect);

        if (isSocketConnected) onConnect();

        return () => {
            socket.off("connect", onConnect);
            socket.off("joined_doc", onJoinedDoc);
            socket.off("join_doc_error", onJoinDocError);
            socket.off("doc_not_found", onDocNotFound);
            socket.off("left_doc", onLeftOrDisconnect);
            socket.off("disconnect", onLeftOrDisconnect);
            socket.emit("leave_doc");
        };
    }, [documentId, isSocketConnected]);

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
    // client SV against serverSV: any divergence triggers a repair_doc.
    useEffect(() => {
        const onSyncDoc = (update: Uint8Array, serverSV: Uint8Array) => {
            flashApplying();
            Y.applyUpdate(yDoc, new Uint8Array(update), REMOTE_ORIGIN);
            const clientSVMap = Y.decodeStateVector(Y.encodeStateVector(yDoc));
            const serverSVMap = Y.decodeStateVector(new Uint8Array(serverSV));
            if (!mapsEqual(clientSVMap, serverSVMap)) {
                flashRestoring();
                socket.emit(REPAIR_DOC, Y.encodeStateVector(yDoc));
            }
        };
        socket.on(SYNC_DOC, onSyncDoc);
        return () => {
            socket.off(SYNC_DOC, onSyncDoc);
        };
    }, [yDoc]);


    // Receive repair_doc from server — compute and send back the diff from the server's SV.
    useEffect(() => {
        const onRepairDoc = (serverSV: Uint8Array) => {
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

    // Heartbeat: bidirectional reconciliation — fires immediately on join/reconnect and then
    // every HEARTBEAT_INTERVAL_MS. Using the heartbeat (rather than a one-shot repair_doc)
    // ensures both directions are repaired: the server sends what the client missed, and the
    // client sends back what the server missed (e.g. edits made while offline).
    // Gated on isDocJoined and isIndexedDBSynced so no stale SV is sent too early.
    useEffect(() => {
        const initiateHeartbeat = () => {
            if (!isDocJoined || !isIndexedDBSynced) return;
            flashRestoring();
            socket.emit(HEARTBEAT_SYNC, Y.encodeStateVector(yDoc));
        };

        const id = setInterval(
            () => initiateHeartbeat(),
            HEARTBEAT_INTERVAL_MS,
        );
        initiateHeartbeat();

        return () => clearInterval(id);
    }, [yDoc, isDocJoined, isIndexedDBSynced]);

    // heartbeat_syncack: server sends what we're missing plus its own SV.
    // Apply the diff, then send back what the server is missing.
    useEffect(() => {
        const onSyncAck = (diff: Uint8Array, serverSV: Uint8Array) => {
            Y.applyUpdate(yDoc, new Uint8Array(diff), REMOTE_ORIGIN);
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

    // sync_title: server broadcasts when any client PATCHes the title.
    // Update local title state so all connected clients stay in sync in real time.
    useEffect(() => {
        const onSyncTitle = (incoming: string) => {
            setTitle(incoming);
            // Flash the dim effect for 500ms to indicate a remote title update arrived.
            setIsTitleSyncing(true);
            setTimeout(() => setIsTitleSyncing(false), 500);
        };
        socket.on(SYNC_TITLE, onSyncTitle);
        return () => {
            socket.off(SYNC_TITLE, onSyncTitle);
        };
    }, []);

    return { title, isDocJoined, isTitleSyncing };
};

export default useSyncEditorChanges;
