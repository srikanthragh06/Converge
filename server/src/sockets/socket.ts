import * as Y from "yjs";
import {
    DOC_ID,
    REMOTE_ORIGIN,
    SYNC_DOC,
    REPAIR_DOC,
    REPAIR_RESPONSE,
} from "../constants";
import { TypedSocket } from "../types";
import { safeSocketHandler } from "../utils";

// Authoritative server Y.Doc — holds the full document state in memory.
// Primary job: answer repair_doc requests with the correct diff.
const yDoc = new Y.Doc();

export const handleDocSocketConnection = (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // All clients join the same room so broadcasts are scoped to the document
    socket.join(DOC_ID);

    // sync_doc: relay-first (before applying locally), then update the server Y.Doc.
    // Relay-first ensures other clients aren't blocked waiting on the server's apply step.
    socket.on(
        SYNC_DOC,
        safeSocketHandler((update: Uint8Array) => {
            // 1. Relay raw update to every other client in the room
            socket.to(DOC_ID).emit(SYNC_DOC, update);
            // 2. Apply to server Y.Doc tagged as remote to prevent any re-broadcast loop
            Y.applyUpdate(yDoc, new Uint8Array(update), REMOTE_ORIGIN);
        }),
    );

    // repair_doc: client sends its current state vector.
    // Server responds with a diff containing everything the client is missing.
    socket.on(
        REPAIR_DOC,
        safeSocketHandler((clientSV: Uint8Array) => {
            const diff = Y.encodeStateAsUpdate(yDoc, new Uint8Array(clientSV));
            socket.emit(REPAIR_RESPONSE, diff);
        }),
    );

    socket.on(
        "disconnect",
        safeSocketHandler(() => {
            console.log(`Client disconnected: ${socket.id}`);
        }),
    );
};
