import { useEffect } from "react";
import type { BlockNoteEditor } from "@blocknote/core";

/**
 * Focuses the editor once the document is confirmed ready, if it is not already
 * focused. Re-runs when documentId changes (i.e. on document switch) so the new
 * document's editor is focused automatically.
 *
 * @param editor - the BlockNote editor instance, or null while the document is still loading
 * @param documentId - the current document ID from the URL
 * @param documentStatus - the fetch status of the document
 */
const useEditorFocus = (
    editor: BlockNoteEditor | null,
    documentId: string | undefined,
    documentStatus: "loading" | "ready" | "forbidden" | "notFound",
) => {
    // Focuses the editor when the document becomes ready or the document ID changes
    // (i.e. on document switch). Skips focus if the editor already has it to avoid
    // stealing focus from other UI elements such as the title input.
    useEffect(() => {
        if (
            editor &&
            documentId &&
            documentStatus === "ready" &&
            !editor.isFocused()
        ) {
            editor.focus();
        }
    }, [editor, documentId, documentStatus]);
};

export default useEditorFocus;
