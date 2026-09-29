import { atom } from "jotai";
import type { ResolvedDocumentAccessLevel } from "@converge/shared";

/** The resolved access level of the currently open document, or null when no document is loaded. */
export const documentAccessAtom = atom<ResolvedDocumentAccessLevel | null>(
    null,
);

/** A document dialog that can open from anywhere in the app shell. */
export type DocumentDialog = {
    kind: "share" | "details";
    documentId: number;
    title: string;
};

/**
 * The open Share or Document details dialog, or null. Set from the editor
 * header or a sidebar row menu; rendered once by DocumentDialogs in Page.
 * Version history isn't here: it needs the live editor, so it opens inside
 * the editor page instead (see openVersionHistory in useDocumentMenuActions).
 */
export const documentDialogAtom = atom<DocumentDialog | null>(null);
