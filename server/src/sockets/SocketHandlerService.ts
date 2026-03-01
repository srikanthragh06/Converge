// Socket.IO connection handler for the collaborative document room.
// Each connection lazy-loads the Y.Doc via DocStoreService.getDoc() so the doc is only
// in memory when at least one client is connected (or has recently disconnected).
// All dependencies are accessed via the global container.

import * as Y from "yjs";
import {
    DOC_ID,
    DOCUMENT_ID,
    REMOTE_ORIGIN,
    SYNC_DOC,
    REPAIR_DOC,
    REPAIR_RESPONSE,
    HEARTBEAT_SYNC,
    HEARTBEAT_SYNCACK,
    HEARTBEAT_ACK,
} from "../constants";
import { TypedSocket } from "../types";
import { safeSocketHandler, mapsEqual } from "../utils";
import { servicesStore } from "../servicesStore";

export class SocketHandlerService {
    // Registered on io.on("connection", ...) by App.
    // Lazy-loads the Y.Doc then registers all event handlers for this socket.
    async handleConnection(socket: TypedSocket): Promise<void> {
        console.log(`Client connected: ${socket.id}`);

        // Lazy-load: retrieves the Y.Doc from cache or loads from Postgres.
        // All handlers below close over this resolved yDoc reference.
        const yDoc = await servicesStore.docStoreService.getDoc(DOC_ID);

        // All clients join the same room so broadcasts are scoped to the document.
        socket.join(DOC_ID);

        socket.on(
            SYNC_DOC,
            safeSocketHandler(async (update: Uint8Array, clientSV: Uint8Array) => {
                await this.handleSyncDoc(socket, yDoc, update, clientSV);
            }),
        );

        socket.on(
            REPAIR_DOC,
            safeSocketHandler((clientSV: Uint8Array) => {
                this.handleRepairDoc(socket, yDoc, clientSV);
            }),
        );

        socket.on(
            REPAIR_RESPONSE,
            safeSocketHandler(async (diff: Uint8Array) => {
                await this.handleRepairResponse(socket, yDoc, diff);
            }),
        );

        socket.on(
            HEARTBEAT_SYNC,
            safeSocketHandler((clientSV: Uint8Array) => {
                this.handleHeartbeatSync(socket, yDoc, clientSV);
            }),
        );

        socket.on(
            HEARTBEAT_ACK,
            safeSocketHandler(async (diff: Uint8Array) => {
                await this.handleHeartbeatAck(socket, yDoc, diff);
            }),
        );

        socket.on(
            "disconnect",
            safeSocketHandler(() => {
                console.log(`Client disconnected: ${socket.id}`);
            }),
        );
    }

    // sync_doc: client sends its update AND its current state vector.
    // Apply to server Y.Doc first, then relay update + serverSV to other clients.
    // Apply-before-relay ensures the piggybacked serverSV is accurate.
    // After relaying, compare server SV against the originating client's SV — any
    // divergence means one or both sides are missing ops, so a bidirectional repair fires.
    private async handleSyncDoc(
        socket: TypedSocket,
        yDoc: Y.Doc,
        update: Uint8Array,
        clientSV: Uint8Array,
    ): Promise<void> {
        servicesStore.docStoreService.touchDoc(DOC_ID);

        // 1. Publish to Redis so other server instances receive and relay the update.
        servicesStore.pubSubService.publishUpdate(DOC_ID, new Uint8Array(update));

        // 2. Persist to Postgres, then check whether compaction should be triggered.
        const { count, lastCompactCount } = await servicesStore.persistenceService.saveUpdate(
            DOCUMENT_ID,
            new Uint8Array(update),
        );
        servicesStore.compactorService.compact(DOCUMENT_ID, count, lastCompactCount);

        // 3. Apply to server Y.Doc tagged as remote to prevent re-broadcast loops.
        //    Apply before relay so the serverSV we piggyback reflects this update.
        Y.applyUpdate(yDoc, new Uint8Array(update), REMOTE_ORIGIN);

        // 4. Relay update + current serverSV to every other client in the room.
        //    Recipients use the SV to detect their own divergence without a round trip.
        const serverSV = Y.encodeStateVector(yDoc);
        socket.to(DOC_ID).emit(SYNC_DOC, update, serverSV);

        // 5. Compare server SV against the originating client's SV.
        //    If they differ, either side has ops the other is missing.
        //    Repair both directions in one shot.
        const serverSVMap = Y.decodeStateVector(serverSV);
        const clientSVMap = Y.decodeStateVector(new Uint8Array(clientSV));

        if (!mapsEqual(serverSVMap, clientSVMap)) {
            socket.emit(REPAIR_DOC, serverSV);
            socket.emit(
                REPAIR_RESPONSE,
                Y.encodeStateAsUpdate(yDoc, new Uint8Array(clientSV)),
            );
        }
    }

    // repair_doc: client sends its current state vector.
    // Server responds with a diff containing everything the client is missing.
    private handleRepairDoc(
        socket: TypedSocket,
        yDoc: Y.Doc,
        clientSV: Uint8Array,
    ): void {
        servicesStore.docStoreService.touchDoc(DOC_ID);

        const diff = Y.encodeStateAsUpdate(yDoc, new Uint8Array(clientSV));
        socket.emit(REPAIR_RESPONSE, diff);
    }

    // repair_response: client sends a diff in response to our repair_doc request.
    // Relay to all other clients, persist the new content, then apply locally.
    private async handleRepairResponse(
        socket: TypedSocket,
        yDoc: Y.Doc,
        diff: Uint8Array,
    ): Promise<void> {
        servicesStore.docStoreService.touchDoc(DOC_ID);

        // 1. Relay repair diff to all other clients on this server.
        socket.to(DOC_ID).emit(REPAIR_RESPONSE, diff);

        // 2. Publish to Redis so other server instances relay the diff too.
        servicesStore.pubSubService.publishUpdate(DOC_ID, new Uint8Array(diff));

        // 3. Persist — this is new content the server was missing.
        const { count, lastCompactCount } = await servicesStore.persistenceService.saveUpdate(
            DOCUMENT_ID,
            new Uint8Array(diff),
        );
        servicesStore.compactorService.compact(DOCUMENT_ID, count, lastCompactCount);

        // 4. Apply locally to bring the server Y.Doc into full sync.
        Y.applyUpdate(yDoc, new Uint8Array(diff), REMOTE_ORIGIN);
    }

    // heartbeat_sync: client sends its current SV every HEARTBEAT_INTERVAL_MS.
    // Server computes what the client is missing and responds with that diff plus
    // its own SV so the client can compute the reverse diff in heartbeat_ack.
    private handleHeartbeatSync(
        socket: TypedSocket,
        yDoc: Y.Doc,
        clientSV: Uint8Array,
    ): void {
        servicesStore.docStoreService.touchDoc(DOC_ID);

        const serverSV = Y.encodeStateVector(yDoc);
        const diffForClient = Y.encodeStateAsUpdate(
            yDoc,
            new Uint8Array(clientSV),
        );
        socket.emit(HEARTBEAT_SYNCACK, diffForClient, serverSV);
    }

    // heartbeat_ack: client sends what the server is missing (computed from the
    // serverSV it received in heartbeat_syncack). Publish to Redis so other server
    // instances receive the recovered content, then persist and apply locally.
    private async handleHeartbeatAck(
        socket: TypedSocket,
        yDoc: Y.Doc,
        diff: Uint8Array,
    ): Promise<void> {
        servicesStore.docStoreService.touchDoc(DOC_ID);

        // Relay to other server instances via Redis.
        servicesStore.pubSubService.publishUpdate(DOC_ID, new Uint8Array(diff));

        // Persist the new content, then apply to bring server Y.Doc fully in sync.
        const { count, lastCompactCount } = await servicesStore.persistenceService.saveUpdate(
            DOCUMENT_ID,
            new Uint8Array(diff),
        );
        servicesStore.compactorService.compact(DOCUMENT_ID, count, lastCompactCount);
        Y.applyUpdate(yDoc, new Uint8Array(diff), REMOTE_ORIGIN);
    }
}
