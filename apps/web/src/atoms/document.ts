import { atom } from "jotai";
import type { ResolvedDocumentAccessLevel } from "@converge/shared";

/** The resolved access level of the currently open document, or null when no document is loaded. */
export const documentAccessAtom = atom<ResolvedDocumentAccessLevel | null>(
    null,
);
