// Socket.IO connection handler for collaborative documents.
// handleSocketMiddleware validates the JWT cookie before a connection is accepted.
// handleConnection wires every socket event to a named private handler method.
// Sync handlers guard inside the method body: if socket.data.documentId is unset
// they return early and are no-ops — safe before a successful join_doc.
// join_doc checks that the document exists (created via POST /documents); it emits
// join_doc_error if not found and does NOT auto-create the row.
// All subsequent handlers retrieve the Y.Doc from YDocStoreService (cache hit after join).
// All dependencies are accessed via the global container.

import { parse as parseCookie } from "cookie";
import * as Y from "yjs";
import { TypedSocket } from "../types/types";
import { safeSocketHandler, mapsEqual } from "../utils/utils";
import { servicesStore } from "../store/servicesStore";
import { REMOTE_ORIGIN, hasAccess } from "../constants/constants";

export class SocketHandlerService {
    // Socket.IO event names — must match the client-side constants exactly.
    static readonly JOIN_DOC = "join_doc";
    static readonly JOINED_DOC = "joined_doc";
    static readonly JOIN_DOC_ERROR = "join_doc_error";
    static readonly DOC_NOT_FOUND = "doc_not_found";
    static readonly JOIN_DOC_FORBIDDEN = "join_doc_forbidden"; // user is authenticated but has no access row for this document
    static readonly LEAVE_DOC = "leave_doc";
    static readonly LEFT_DOC = "left_doc";
    static readonly SYNC_DOC = "sync_doc";
    static readonly REPAIR_DOC = "repair_doc";
    static readonly REPAIR_RESPONSE = "repair_response";
    static readonly HEARTBEAT_SYNC = "heartbeat_sync";
    static readonly HEARTBEAT_SYNCACK = "heartbeat_syncack";
    static readonly HEARTBEAT_ACK = "heartbeat_ack";
    static readonly SYNC_TITLE = "sync_title";
    static readonly SOCKET_PING = "socket_ping";
    static readonly SOCKET_PONG = "socket_pong";
    // How often the client fires a heartbeat (milliseconds).
    static readonly HEARTBEAT_INTERVAL_MS = 10_000;

    // Socket.IO middleware registered via io.use() in App.
    // Reads the JWT from the httpOnly "token" cookie in the handshake headers,
    // verifies it, and attaches the decoded user to socket.data.
    // Connections without a valid JWT are rejected with an "unauthorized" error.
    handleSocketMiddleware(
        socket: TypedSocket,
        next: (err?: Error) => void,
    ): void {
        const rawCookie = socket.handshake.headers.cookie ?? "";
        const cookies = parseCookie(rawCookie);
        const token = cookies["token"];

        if (!token) {
            next(new Error("unauthorized"));
            return;
        }

        const payload = servicesStore.authService.verifyJwt(token);

        if (!payload) {
            next(new Error("unauthorized"));
            return;
        }

        socket.data.user = {
            id: payload.id,
            email: payload.email,
            displayName: payload.displayName,
            avatarUrl: payload.avatarUrl,
        };

        next();
    }

    // Registered on io.on("connection", ...) by App.
    // Wires every socket event to a named private handler.
    async handleConnection(socket: TypedSocket): Promise<void> {
        console.log(`Client connected: ${socket.id}`);

        socket.on(
            SocketHandlerService.JOIN_DOC,
            safeSocketHandler(async (rawDocumentId: number) => {
                await this.handleJoinDoc(socket, rawDocumentId);
            }),
        );

        socket.on(
            SocketHandlerService.LEAVE_DOC,
            safeSocketHandler(() => {
                this.handleLeaveDoc(socket);
            }),
        );

        socket.on(
            SocketHandlerService.SYNC_DOC,
            safeSocketHandler(
                async (update: Uint8Array, clientSV: Uint8Array) => {
                    await this.handleSyncDoc(socket, update, clientSV);
                },
            ),
        );

        socket.on(
            SocketHandlerService.REPAIR_DOC,
            safeSocketHandler(async (clientSV: Uint8Array) => {
                await this.handleRepairDoc(socket, clientSV);
            }),
        );

        socket.on(
            SocketHandlerService.REPAIR_RESPONSE,
            safeSocketHandler(async (diff: Uint8Array) => {
                await this.handleRepairResponse(socket, diff);
            }),
        );

        socket.on(
            SocketHandlerService.HEARTBEAT_SYNC,
            safeSocketHandler(async (clientSV: Uint8Array) => {
                await this.handleHeartbeatSync(socket, clientSV);
            }),
        );

        socket.on(
            SocketHandlerService.HEARTBEAT_ACK,
            safeSocketHandler(async (diff: Uint8Array) => {
                await this.handleHeartbeatAck(socket, diff);
            }),
        );

        // socket_ping: echo the client's timestamp back for RTT measurement.
        // No doc join required — pure transport-level probe.
        socket.on(
            SocketHandlerService.SOCKET_PING,
            safeSocketHandler((ts: number) => {
                this.handlePing(socket, ts);
            }),
        );

        socket.on(
            "disconnect",
            safeSocketHandler(() => {
                console.log(`Client disconnected: ${socket.id}`);
            }),
        );
    }

    // join_doc: validates the numeric documentId, checks the document exists
    // (emits doc_not_found if not), checks the user's access level
    // (emits join_doc_forbidden if no row or access < viewer), preloads the Y.Doc,
    // joins the socket room, stores documentId+accessLevel in socket.data, and
    // confirms with joined_doc. Documents must be created via POST /documents — no auto-creation here.
    private async handleJoinDoc(
        socket: TypedSocket,
        rawDocumentId: number,
    ): Promise<void> {
        if (!this.assertAuthed(socket)) return;
        const documentId = parseInt(String(rawDocumentId));
        if (!Number.isInteger(documentId) || documentId < 1) {
            console.warn(
                `join_doc rejected — invalid documentId from ${socket.id}: ${rawDocumentId}`,
            );
            socket.emit(
                SocketHandlerService.JOIN_DOC_ERROR,
                "Invalid document ID",
            );
            return;
        }

        // Reject the join if the document does not exist — no silent auto-creation.
        const exists =
            await servicesStore.persistenceService.documentExists(documentId);
        if (!exists) {
            console.warn(
                `join_doc rejected — document ${documentId} not found`,
            );
            socket.emit(SocketHandlerService.DOC_NOT_FOUND);
            return;
        }

        // Reject the join if the user has no access row or insufficient access (viewer minimum).
        const userId = socket.data.user!.id;
        const accessLevel = await servicesStore.persistenceService.getDocumentAccess(documentId, userId);
        if (!accessLevel || !hasAccess(accessLevel, "viewer")) {
            console.warn(`join_doc rejected — ${socket.id} (user ${userId}) has no access to doc ${documentId}`);
            socket.emit(SocketHandlerService.JOIN_DOC_FORBIDDEN);
            return;
        }

        // Preload Y.Doc so all subsequent sync handlers get a cache hit.
        await servicesStore.docStoreService.getYDocByDocID(String(documentId));
        socket.join(String(documentId));
        socket.data.documentId = documentId;
        socket.data.accessLevel = accessLevel;

        // Fire-and-forget: record that this user viewed the document now.
        // A failed write must not block or undo the join.
        servicesStore.persistenceService
            .upsertLastViewedAt(documentId, userId)
            .catch((err) => console.error("upsertLastViewedAt failed:", err));

        console.log(`${socket.id} joined doc ${documentId} as ${accessLevel}`);
        socket.emit(SocketHandlerService.JOINED_DOC, documentId, accessLevel);
    }

    // leave_doc: leaves the socket room and clears socket.data so sync handlers
    // become no-ops again until the next join_doc.
    private handleLeaveDoc(socket: TypedSocket): void {
        if (!this.assertAuthed(socket)) return;
        if (socket.data.documentId === undefined) return;
        socket.leave(String(socket.data.documentId));
        console.log(`${socket.id} left doc ${socket.data.documentId}`);
        socket.data.documentId = undefined;
        socket.data.accessLevel = undefined;
        socket.emit(SocketHandlerService.LEFT_DOC);
    }

    // sync_doc: publish → apply → relay → persist → SV divergence check.
    // Requires editor access — viewers cannot push updates.
    private async handleSyncDoc(
        socket: TypedSocket,
        update: Uint8Array,
        clientSV: Uint8Array,
    ): Promise<void> {
        if (!this.assertAuthed(socket)) return;
        if (!this.assertEditorAccess(socket)) return;
        if (socket.data.documentId === undefined) return;
        const documentId = socket.data.documentId;
        const userId = socket.data.user!.id;
        const yDoc = await servicesStore.docStoreService.getYDocByDocID(
            String(documentId),
        );
        servicesStore.docStoreService.touchYDoc(String(documentId));

        // 1. Publish to Redis so other server instances receive and relay the update.
        servicesStore.docStoreService.publishYDocUpdate(
            String(documentId),
            new Uint8Array(update),
        );

        // 2. Apply before relay so the piggybacked serverSV is accurate.
        Y.applyUpdate(yDoc, new Uint8Array(update), REMOTE_ORIGIN);

        // 3. Relay to all other clients in the room.
        const serverSV = Y.encodeStateVector(yDoc);
        socket
            .to(String(documentId))
            .emit(SocketHandlerService.SYNC_DOC, update, serverSV);

        // 4. Persist after relay so the DB write does not block the relay path.
        const { count, lastCompactCount } =
            await servicesStore.persistenceService.saveYDocUpdate(
                documentId,
                new Uint8Array(update),
                userId,
            );
        servicesStore.compactorService.checkAndCompactDocumentUpdates(
            documentId,
            count,
            lastCompactCount,
        );

        // 5. Fire-and-forget: record that this user edited the document now.
        servicesStore.persistenceService
            .upsertLastEditedAt(documentId, userId)
            .catch((err) => console.error("upsertLastEditedAt failed:", err));

        // 6. SV divergence check — repair both sides in one shot if needed.
        const serverSVMap = Y.decodeStateVector(serverSV);
        const clientSVMap = Y.decodeStateVector(new Uint8Array(clientSV));
        if (!mapsEqual(serverSVMap, clientSVMap)) {
            socket.emit(SocketHandlerService.REPAIR_DOC, serverSV);
            socket.emit(
                SocketHandlerService.REPAIR_RESPONSE,
                Y.encodeStateAsUpdate(yDoc, new Uint8Array(clientSV)),
            );
        }
    }

    // repair_doc: compute and send a diff from the client's SV to current server state.
    private async handleRepairDoc(
        socket: TypedSocket,
        clientSV: Uint8Array,
    ): Promise<void> {
        if (!this.assertAuthed(socket)) return;
        if (socket.data.documentId === undefined) return;
        const yDoc = await servicesStore.docStoreService.getYDocByDocID(
            String(socket.data.documentId),
        );
        servicesStore.docStoreService.touchYDoc(String(socket.data.documentId));

        const diff = Y.encodeStateAsUpdate(yDoc, new Uint8Array(clientSV));
        socket.emit(SocketHandlerService.REPAIR_RESPONSE, diff);
    }

    // repair_response: relay, publish, persist, then apply locally.
    // Requires editor access — clients send content they hold that the server is missing.
    private async handleRepairResponse(
        socket: TypedSocket,
        diff: Uint8Array,
    ): Promise<void> {
        if (!this.assertAuthed(socket)) return;
        if (!this.assertEditorAccess(socket)) return;
        if (socket.data.documentId === undefined) return;
        const documentId = socket.data.documentId;
        const yDoc = await servicesStore.docStoreService.getYDocByDocID(
            String(documentId),
        );
        servicesStore.docStoreService.touchYDoc(String(documentId));

        // 1. Relay to other local clients first — they have the same gap.
        socket
            .to(String(documentId))
            .emit(SocketHandlerService.REPAIR_RESPONSE, diff);

        // 2. Publish to Redis for other server instances.
        servicesStore.docStoreService.publishYDocUpdate(
            String(documentId),
            new Uint8Array(diff),
        );

        // 3. Persist then check compaction.
        const { count, lastCompactCount } =
            await servicesStore.persistenceService.saveYDocUpdate(
                documentId,
                new Uint8Array(diff),
                socket.data.user!.id,
            );
        servicesStore.compactorService.checkAndCompactDocumentUpdates(
            documentId,
            count,
            lastCompactCount,
        );

        // 4. Apply locally to bring the server Y.Doc fully in sync.
        Y.applyUpdate(yDoc, new Uint8Array(diff), REMOTE_ORIGIN);
    }

    // heartbeat_sync: compute and send what the client is missing plus the server SV.
    private async handleHeartbeatSync(
        socket: TypedSocket,
        clientSV: Uint8Array,
    ): Promise<void> {
        if (!this.assertAuthed(socket)) return;
        if (socket.data.documentId === undefined) return;
        const yDoc = await servicesStore.docStoreService.getYDocByDocID(
            String(socket.data.documentId),
        );
        servicesStore.docStoreService.touchYDoc(String(socket.data.documentId));

        const serverSV = Y.encodeStateVector(yDoc);
        const diffForClient = Y.encodeStateAsUpdate(
            yDoc,
            new Uint8Array(clientSV),
        );
        socket.emit(
            SocketHandlerService.HEARTBEAT_SYNCACK,
            diffForClient,
            serverSV,
        );
    }

    // heartbeat_ack: publish, relay, persist, then apply what the server was missing.
    // Requires editor access — the client is sending content the server is missing.
    private async handleHeartbeatAck(
        socket: TypedSocket,
        diff: Uint8Array,
    ): Promise<void> {
        if (!this.assertAuthed(socket)) return;
        if (!this.assertEditorAccess(socket)) return;
        if (socket.data.documentId === undefined) return;
        const documentId = socket.data.documentId;
        const yDoc = await servicesStore.docStoreService.getYDocByDocID(
            String(documentId),
        );
        servicesStore.docStoreService.touchYDoc(String(documentId));

        // 1. Publish to Redis so other instances receive the recovered content.
        servicesStore.docStoreService.publishYDocUpdate(
            String(documentId),
            new Uint8Array(diff),
        );

        // 2. Relay to other clients on this instance — they have the same gap.
        socket
            .to(String(documentId))
            .emit(SocketHandlerService.REPAIR_RESPONSE, diff);

        // 3. Persist and check compaction.
        const { count, lastCompactCount } =
            await servicesStore.persistenceService.saveYDocUpdate(
                documentId,
                new Uint8Array(diff),
                socket.data.user!.id,
            );
        servicesStore.compactorService.checkAndCompactDocumentUpdates(
            documentId,
            count,
            lastCompactCount,
        );

        // 4. Apply locally to bring the server Y.Doc fully in sync.
        Y.applyUpdate(yDoc, new Uint8Array(diff), REMOTE_ORIGIN);
    }

    // socket_ping: echo the client's timestamp straight back so it can compute RTT.
    private handlePing(socket: TypedSocket, ts: number): void {
        if (!this.assertAuthed(socket)) return;
        socket.emit(SocketHandlerService.SOCKET_PONG, ts);
    }

    // Returns true if the socket has an authenticated user attached.
    // Disconnects the socket and returns false if not — callers must return immediately.
    private assertAuthed(socket: TypedSocket): boolean {
        if (!socket.data.user) {
            socket.disconnect();
            return false;
        }
        return true;
    }

    // Returns true if the socket's joined document access level is editor or above.
    // Returns false and logs a warning if the user is a viewer or has no access level set.
    // Does NOT disconnect — the user has a valid session and valid viewer access; they just
    // attempted a write operation beyond their permission level.
    private assertEditorAccess(socket: TypedSocket): boolean {
        if (!socket.data.accessLevel || !hasAccess(socket.data.accessLevel, "editor")) {
            console.warn(
                `${socket.id} attempted write without editor access (level: ${socket.data.accessLevel ?? "none"})`,
            );
            return false;
        }
        return true;
    }
}
