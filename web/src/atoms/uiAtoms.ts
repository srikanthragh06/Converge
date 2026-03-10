// Jotai atoms for UI state — auth state, ping latency, and sync status indicators.
// These are separate from Y.Doc (collaborative content) state.
import { atom } from "jotai";
import { AuthedUser } from "../types/api";

// Whether the current user is authenticated (JWT cookie verified via /auth/me).
// Set to true by useAuth on success; false until verified or on 401.
export const isAuthedAtom = atom<boolean>(false);

// The authenticated user's profile. null until /auth/me returns successfully.
export const currentUserAtom = atom<AuthedUser | null>(null);

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

// Whether the global Ctrl+P document search overlay is open.
// Set by the Ctrl+P keydown listener in App; read by DocSearchOverlay.
export const isDocSearchOpenAtom = atom<boolean>(false);
