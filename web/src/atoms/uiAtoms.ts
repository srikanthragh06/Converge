// Jotai atoms for UI state — ping latency and sync status indicators.
// These are separate from Y.Doc (collaborative content) state.
import { atom } from "jotai";

// Whether the socket is currently connected to the server.
// Written by useSocket; read by usePing to react immediately on reconnect.
export const isSocketConnectedAtom = atom<boolean>(false);

// Round-trip latency to the server in milliseconds. null = not yet measured.
export const pingMsAtom = atom<number | null>(null);

// True while a sync repair or heartbeat cycle is in flight.
// Set when client sends repair_doc or heartbeat_sync; cleared on repair_response / heartbeat_ack.
export const isRestoringSyncAtom = atom<boolean>(false);

// True briefly when a remote update arrives and is being applied to the local Y.Doc.
// Set on sync_doc or repair_response receive; auto-clears after a short display window.
export const isApplyingUpdatesAtom = atom<boolean>(false);
