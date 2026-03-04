// Cross-server Yjs update distribution via Redis pub/sub.
//
// Accesses Redis clients and the Socket.IO server via the global container.
//
// init() — attach the single global Redis message handler; call once at startup.
//          Routes incoming channel messages to YDocStoreService for processing.
//
// Per-doc subscription lifecycle (subscribe/publish/unsubscribe) lives in
// YDocStoreService, which owns all doc-scoped state.

import { servicesStore } from "../store/servicesStore";

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
    // Strips the channel prefix to extract the docId, then delegates to
    // YDocStoreService which owns all per-doc state and apply/broadcast logic.
    private handleDocumentUpdateMessage(
        channel: string,
        rawMessage: string,
    ): void {
        if (!channel.startsWith(PubSubService.DOCUMENT_UPDATE_CHANNEL)) return;

        const docId = channel.slice(PubSubService.DOCUMENT_UPDATE_CHANNEL.length);
        servicesStore.docStoreService.handleRedisDocumentUpdate(docId, rawMessage);
    }
}
