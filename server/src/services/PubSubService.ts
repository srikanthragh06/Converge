// Cross-server Yjs update distribution via Redis pub/sub.
//
// Accesses Redis clients and the Socket.IO server via the global container.
//
// init() — attach the single global Redis message handler; call once at startup.
//          Routes incoming channel messages to YDocStoreService for processing.
//
// Per-doc subscription lifecycle (subscribe/publish/unsubscribe) lives in
// YDocStoreService, which owns all doc-scoped state.

import * as Y from "yjs";
import { servicesStore } from "../store/servicesStore";
import { SocketHandlerService } from "./SocketHandlerService";
import { REMOTE_ORIGIN } from "../constants/constants";

export class PubSubService {
    // Redis pub/sub channel prefix for Yjs document updates.
    // Public so YDocStoreService can construct channel names without duplicating the string.
    public static readonly DOCUMENT_UPDATE_CHANNEL = "document_update_channel:";

    // Must be called once at server startup before any client connects.
    // Registers the single global Redis message handler on the sub client.
    // Routes each incoming message to YDocStoreService by stripping the channel prefix.
    init(): void {
        servicesStore.redisService.sub.on(
            "message",
            (channel: string, rawMessage: string) => {
                this.handleDocumentUpdateMessage(channel, rawMessage);
            },
        );
    }

    // Routes a raw Redis message to the correct doc handler.
    // Called for every incoming pub/sub message on any subscribed channel.
    private handleDocumentUpdateMessage(
        channel: string,
        rawMessage: string,
    ): void {
        if (!channel.startsWith(PubSubService.DOCUMENT_UPDATE_CHANNEL)) return;

        const docId = channel.slice(
            PubSubService.DOCUMENT_UPDATE_CHANNEL.length,
        );
        const entry = servicesStore.docStoreService.getYDocRedisSubEntry(docId);
        if (!entry) return;

        // Redis delivers messages as strings. The publisher encoded bytes as latin1
        // (lossless binary↔string mapping). Reverse that here to get raw bytes.
        const update = new Uint8Array(Buffer.from(rawMessage, "binary"));

        if (!entry.live) {
            // Still loading from Postgres — buffer for flush in activateYDocRedisChannel().
            entry.buffer.push(update);
            return;
        }

        // Live: apply first so the piggybacked serverSV is accurate, then broadcast.
        // REMOTE_ORIGIN tag prevents any observer in this process from re-publishing.
        Y.applyUpdate(entry.yDoc, update, REMOTE_ORIGIN);
        servicesStore.httpServerService.io
            .to(docId)
            .emit(
                SocketHandlerService.SYNC_DOC,
                update,
                Y.encodeStateVector(entry.yDoc),
            );
    }
}
