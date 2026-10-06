import { atom } from "jotai";

/** Title of the document open in the editor, or null on any other page. Lets the app shell (e.g. Ask Converge's empty state) name it. */
export const openDocumentTitleAtom = atom<string | null>(null);

/** A document dialog that can open from anywhere in the app shell. */
export type DocumentDialog = {
    kind: "share" | "details";
    documentId: number;
    title: string;
};

/**
 * The open Share or Document details dialog, or null. Set from the editor
 * header or a sidebar row menu; rendered once by DocumentDialogs in AppShell.
 * Version history isn't here: it needs the live editor, so it opens inside
 * the editor page instead (see openVersionHistory in useDocumentMenuActions).
 */
export const documentDialogAtom = atom<DocumentDialog | null>(null);
