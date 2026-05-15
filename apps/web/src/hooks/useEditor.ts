import { BlockNoteEditor } from "@blocknote/core";
import { useEffect, useMemo } from "react";
import { yUndoPluginKey } from "y-prosemirror";
import { useParams } from "react-router-dom";
import useSocket from "./useSocket";
import useYjsSync from "./useYjsSync";
import useDocumentTitle from "./useDocumentTitle";
import useDocumentFetch from "./useDocumentFetch";

/**
 * Composes the sub-hooks for document fetching, Yjs sync, and title sync into
 * a single surface consumed by EditorPage. Creates the BlockNote editor instance
 * backed by the shared Y.Doc and returns all state needed to render the page.
 */
const useEditor = () => {
    const { documentId } = useParams<{ documentId: string }>(); // document ID from the URL path

    const { yDoc } = useYjsSync(documentId);

    const { title, setTitle, isTitlePending, handleTitleChange } =
        useDocumentTitle();

    const { documentStatus, documentAccess } = useDocumentFetch(
        documentId,
        setTitle,
    );

    // Connect the socket only once the document is confirmed — prevents the gateway
    // from receiving a connection with an invalid or inaccessible document ID.
    useSocket(documentStatus === "ready", documentId);

    // Re-created whenever yDoc changes (i.e. on document switch) with a stub collaboration config
    const editor = useMemo(() => {
        return BlockNoteEditor.create({
            // Stub collaboration config to wire up the Y.Doc fragment. Provider
            // and user identity will be replaced once the WebSocket sync provider
            // is connected.
            collaboration: {
                fragment: yDoc.getXmlFragment("blocknote"),
                provider: {},
                user: { name: "", color: "" },
            },
            // Override the default paste handler so that plain-text pastes are
            // interpreted as Markdown rather than inserted as a literal string.
            pasteHandler: ({ event, editor: e, defaultPasteHandler }) => {
                if (event.clipboardData?.types.includes("text/plain")) {
                    e.pasteMarkdown(event.clipboardData.getData("text/plain"));
                    return true;
                }

                return defaultPasteHandler();
            },
        });
    }, [yDoc]);

    // Workaround for a BlockNote/TipTap lifecycle bug that breaks undo and redo.
    //
    // When BlockNoteView unmounts (React Strict Mode double-invoke, or navigating
    // away then back), TipTap calls editor.unmount() → editorView.destroy() →
    // yUndoPlugin.view.destroy() → undoManager.destroy(). destroy() permanently
    // breaks undo/redo — re-registering the handler afterwards does not fully
    // restore behaviour because super.destroy() clears internal ObservableV2 state
    // that the handler relies on.
    //
    // Fix: override destroy() to a no-op so BlockNoteView unmount cannot break the
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

    return {
        editor,
        documentStatus,
        documentAccess,
        title,
        handleTitleChange,
        isTitlePending,
        documentId,
    };
};

export default useEditor;
