import { atom } from "jotai";

export const isSocketConnectedAtom = atom<boolean>(false); // tracks whether the Socket.io connection to the server is currently active

export const syncStatusAtom = atom<
    "offline" | "restoring" | "typing" | "syncing" | null
>(null); // derived sync state surfaced to the UI — priority: offline > restoring > typing > syncing
