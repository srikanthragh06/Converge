// Central registry of all Socket.io event names shared between server and web.
// Using constants avoids typos and makes renaming events safe across both ends.
export const SOCKET_EVENTS = {
    // ── Lifecycle ─────────────────────────────────────────────────────────────
    CONNECT: "connect",
    CONNECT_ERROR: "connect_error",
    DISCONNECT: "disconnect",

    // ── Ping / Pong ───────────────────────────────────────────────────────────
    PING: "ping",
    PONG: "pong",

    // ── Sync Doc ──────────────────────────────────────────────────────────────
    SYNC_DOC_SERVER: "sync-doc-server",
    SYNC_DOC_CLIENT: "sync-doc-client",

    // ── Repair Sync Doc ───────────────────────────────────────────────────────
    REPAIR_SYNC_DOC_SERVER: "repair-sync-doc-server",
    REPAIR_SYNC_DOC_CLIENT: "repair-sync-doc-client",

    // ── Repair Sync Ack Doc ───────────────────────────────────────────────────
    REPAIR_SYNC_ACK_DOC_SERVER: "repair-sync-ack-doc-server",
    REPAIR_SYNC_ACK_DOC_CLIENT: "repair-sync-ack-doc-client",

    // ── Repair Ack Doc ────────────────────────────────────────────────────────
    REPAIR_ACK_DOC_SERVER: "repair-ack-doc-server",
    REPAIR_ACK_DOC_CLIENT: "repair-ack-doc-client",

    // ── Doc Ready ─────────────────────────────────────────────────────────────
    DOC_READY: "doc-ready",

    // ── Sync title ──────────────────────────────────────────────────────────────
    SYNC_DOC_TITLE_SERVER: "sync-doc-title-server",
    SYNC_DOC_TITLE_CLIENT: "sync-doc-title-client",
    SYNC_DOC_TITLE_ACK: "sync-doc-title-ack",
} as const;
