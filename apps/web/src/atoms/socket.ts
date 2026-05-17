import { atom } from "jotai";

export const isSocketReadyAtom = atom<boolean>(false); // true only after the server emits DOC_READY, confirming handleConnection has fully completed

export const syncStatusAtom = atom<
    "offline" | "restoring" | "typing" | "syncing" | null
>(null); // derived sync state surfaced to the UI — priority: offline > restoring > typing > syncing
