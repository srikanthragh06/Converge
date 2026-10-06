import { useEffect } from "react";
import { yUndoPluginKey } from "y-prosemirror";
import type { BlockNoteEditor } from "@blocknote/core";
import type * as Y from "yjs";

/**
 * Prevents the Yjs UndoManager from being permanently broken when BlockNoteView
 * unmounts (React Strict Mode double-invoke, or navigating between documents).
 *
 * Root cause: when BlockNoteView unmounts, TipTap calls editor.unmount() →
 * editorView.destroy() → yUndoPlugin.view.destroy() → undoManager.destroy().
 * destroy() does three things that permanently break undo/redo:
 *   1. Calls yDoc.off('afterTransaction', afterTransactionHandler) — so no user
 *      transactions are ever captured, leaving undoStack empty forever.
 *   2. Calls this.trackedOrigins.delete(this) — so undo transactions (origin =
 *      undoManager) are not recorded into redoStack, breaking redo.
 *   3. Calls super.destroy() (ObservableV2) which replaces this._observers with a
 *      fresh empty Map — wiping the stack-item-added/popped listeners that
 *      afterTransactionHandler relies on internally when pushing to undoStack.
 *
 * On remount, TipTap reuses the old plugin state via state.reconfigure() without
 * re-running yUndoPlugin.init, so the dead UndoManager stays in place. Simply
 * re-registering the handler and trackedOrigins does not fully restore behaviour
 * because the cleared _observers (point 3) cannot be trivially rebuilt — empirically,
 * all three filter conditions in the handler pass yet undoStack still stays at 0.
 *
 * Fix: override undoManager.destroy() to a no-op immediately after the editor is
 * created, so BlockNoteView unmount cannot break it. The real destroy() is deferred
 * to the effect cleanup, which fires only when editor/yDoc change (document switch)
 * or the component unmounts — at which point the old instance is properly destroyed.
 *
 * @param editor - the BlockNote editor instance for this document
 * @param yDoc - the Y.Doc backing the editor
 */
const useUndoManagerGuard = (
    editor: BlockNoteEditor | null,
    yDoc: Y.Doc | null,
) => {
    // Override destroy() to a no-op so BlockNoteView unmount cannot break the
    // UndoManager. The real cleanup is deferred to the effect's return function,
    // which fires when editor/yDoc change (document switch) or the component
    // unmounts, at which point the actual destroy is called on the old instance.
    useEffect(() => {
        if (!editor || !yDoc) return;
        const undoManager = yUndoPluginKey.getState(
            editor._tiptapEditor.state,
        )?.undoManager;
        if (!undoManager) return;

        const originalDestroy = undoManager.destroy.bind(undoManager);
        undoManager.destroy = () => {};

        return () => {
            undoManager.destroy = originalDestroy;
            originalDestroy();
        };
    }, [editor, yDoc]);
};

export default useUndoManagerGuard;
