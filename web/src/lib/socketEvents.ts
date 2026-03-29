// Central registry of all Socket.io event names.
// Using constants avoids typos and makes refactoring event names safe.
export const SOCKET_EVENTS = {
    CONNECT: "connect",
    CONNECT_ERROR: "connect_error",
    DISCONNECT: "disconnect",
    PING: "ping",
    PONG: "pong",
    SYNC: "sync",
    SYNC_REQUEST: "sync_request",
    SYNC_ACK: "sync_ack",
    ACK: "ack",
    ERROR: "error",
} as const;
