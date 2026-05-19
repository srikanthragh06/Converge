import { useEffect } from "react";
import type { BlockNoteEditor } from "@blocknote/core";

/**
 * Tracks the user's cursor position within the editor for awareness.
 * Logs the focused block ID on every selection change and logs null when
 * the editor loses focus. Cleans up all listeners when the editor is unmounted.
 *
 * @param editor - the BlockNote editor instance, or null while the document is still loading
 */
const useAwareness = (editor: BlockNoteEditor | null) => {
    // Registers selection and blur listeners when the editor is available.
    // Re-runs if the editor instance changes (e.g. on document switch).
    useEffect(() => {
        if (!editor) return;

        // Track which block the cursor is in on every selection change.
        const removeSelectionListener = editor.onSelectionChange(() => {
            const { block } = editor.getTextCursorPosition();
            console.log("[awareness] focused block:", block.id);
        });

        // TipTap's blur fires spuriously during internal focus transitions, so
        // isFocused() is checked to confirm the editor truly lost focus before
        // emitting null.
        const handleBlur = () => {
            if (!editor.isFocused())
                console.log("[awareness] focused block: null");
        };

        editor._tiptapEditor.on("blur", handleBlur);

        return () => {
            removeSelectionListener();
            editor._tiptapEditor.off("blur", handleBlur);
        };
    }, [editor]);
};

export default useAwareness;
