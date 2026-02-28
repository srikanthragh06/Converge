// Socket.IO connection handler for the collaborative document room.
// Each connection lazy-loads the Y.Doc via getDoc() so the doc is only in memory
// when at least one client is connected (or has recently disconnected).

import * as Y from "yjs";
import {
    DOC_ID,
    REMOTE_ORIGIN,
    SYNC_DOC,
    REPAIR_DOC,
    REPAIR_RESPONSE,
} from "../constants";
import { TypedSocket } from "../types";
import { safeSocketHandler, mapsEqual } from "../utils";
import { getDoc, touchDoc } from "../store/docStore";
import { saveUpdate } from "../db/persistence";
import { publishUpdate } from "../redis/pubsub";

export const handleDocSocketConnection = async (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // Lazy-load: retrieves the Y.Doc from the in-memory cache or loads it from
    // Postgres if this is the first connection since startup (or after eviction).
    // All handlers below close over this resolved yDoc reference.
    const yDoc = await getDoc(DOC_ID);

    // All clients join the same room so broadcasts are scoped to the document
    socket.join(DOC_ID);

    // sync_doc: relay-first (before applying locally), then update the server Y.Doc.
    // Relay-first ensures other clients aren't blocked waiting on the server's apply step.
    socket.on(
        SYNC_DOC,
        safeSocketHandler((update: Uint8Array) => {
            // Refresh last-access so the sweeper doesn't evict an active doc
            touchDoc(DOC_ID);

            // 1. Relay raw update to every other client in the room on this server
            socket.to(DOC_ID).emit(SYNC_DOC, update);

            // 2. Publish to Redis so other server instances receive and relay the update.
            //    Fire-and-forget — errors are caught inside publishUpdate.
            publishUpdate(DOC_ID, new Uint8Array(update));

            // 3. Persist to Postgres (fire-and-forget — errors are logged inside saveUpdate)
            saveUpdate(new Uint8Array(update));

            // 4. Apply to server Y.Doc tagged as remote to prevent any re-broadcast loop.
            // Compare SVs before and after: if equal, Yjs buffered the op (missing predecessor),
            // so emit repair_doc back to the sender to request what we're missing.
            const svBefore = Y.decodeStateVector(Y.encodeStateVector(yDoc));
            Y.applyUpdate(yDoc, new Uint8Array(update), REMOTE_ORIGIN);
            const svAfter = Y.decodeStateVector(Y.encodeStateVector(yDoc));

            if (mapsEqual(svBefore, svAfter)) {
                socket.emit(REPAIR_DOC, Y.encodeStateVector(yDoc));
            }
        }),
    );

    // repair_doc: client sends its current state vector.
    // Server responds with a diff containing everything the client is missing.
    socket.on(
        REPAIR_DOC,
        safeSocketHandler((clientSV: Uint8Array) => {
            // Refresh last-access on every client interaction
            touchDoc(DOC_ID);

            const diff = Y.encodeStateAsUpdate(yDoc, new Uint8Array(clientSV));
            socket.emit(REPAIR_RESPONSE, diff);
        }),
    );

    // repair_response: client sends a diff in response to our repair_doc request.
    // Relay to all other clients, persist the new content, then apply locally.
    socket.on(
        REPAIR_RESPONSE,
        safeSocketHandler((diff: Uint8Array) => {
            // Refresh last-access on every client interaction
            touchDoc(DOC_ID);

            // 1. Relay repair diff to all other clients on this server
            socket.to(DOC_ID).emit(REPAIR_RESPONSE, diff);

            // 2. Publish to Redis so other server instances relay the diff too
            publishUpdate(DOC_ID, new Uint8Array(diff));

            // 3. Persist — this is new content the server was missing
            saveUpdate(new Uint8Array(diff));

            // 4. Apply locally to bring the server Y.Doc into full sync
            Y.applyUpdate(yDoc, new Uint8Array(diff), REMOTE_ORIGIN);
        }),
    );

    socket.on(
        "disconnect",
        safeSocketHandler(() => {
            console.log(`Client disconnected: ${socket.id}`);
        }),
    );
};
