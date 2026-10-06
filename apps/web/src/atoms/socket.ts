import { atom } from "jotai";
import type { AwarenessUser } from "@converge/shared";

export const socketReadyDocumentIdAtom = atom<number | null>(null); // document whose DOC_READY was last received, null while not ready — consumers compare it with their own documentId, so a stale "ready" from the previous document never counts during a switch

export const syncStatusAtom = atom<
    "offline" | "restoring" | "typing" | "syncing" | null
>(null); // derived sync state surfaced to the UI — priority: offline > restoring > typing > syncing

export const awarenessAtom = atom<AwarenessUser[]>([]); // full presence snapshot for the current document — replaced entirely on every AWARENESS_UPDATE_CLIENT
