import { atom } from "jotai";
import type { AwarenessUser } from "@converge/shared";

export const isSocketReadyAtom = atom<boolean>(false); // true only after the server emits DOC_READY, confirming handleConnection has fully completed

export const syncStatusAtom = atom<
    "offline" | "restoring" | "typing" | "syncing" | null
>(null); // derived sync state surfaced to the UI — priority: offline > restoring > typing > syncing

export const awarenessAtom = atom<AwarenessUser[]>([]); // full presence snapshot for the current document — replaced entirely on every AWARENESS_UPDATE_CLIENT
