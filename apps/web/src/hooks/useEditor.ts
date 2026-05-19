import { BlockNoteEditor } from "@blocknote/core";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import useSocket from "./useSocket";
import useYjsSync from "./useYjsSync";
import useDocumentTitle from "./useDocumentTitle";
import useDocumentFetch from "./useDocumentFetch";
import useUndoManagerGuard from "./useUndoManagerGuard";
import useEditorFocus from "./useEditorFocus";
import useUploadFile from "./useUploadFile";
import deleteBlockExtension from "../lib/deleteBlockExtension";
import editorSchema from "../lib/editorSchema";

/**
 * Composes the sub-hooks for document fetching, Yjs sync, and title sync into
 * a single surface consumed by EditorPage. Creates the BlockNote editor instance
 * backed by the shared Y.Doc and returns all state needed to render the page.
 * editor is null until both documentId and docWorkspace are available — callers
 * must guard against null before rendering the editor.
 */
const useEditor = () => {
    const { documentId } = useParams<{ documentId: string }>(); // document ID from the URL path

    const { yDoc } = useYjsSync(documentId);

    const { title, setTitle, isTitlePending, handleTitleChange } =
        useDocumentTitle();

    const { documentStatus, documentAccess, docWorkspace } = useDocumentFetch(
        documentId,
        setTitle,
    );

    // Connect the socket only once the document is confirmed — prevents the gateway
    // from receiving a connection with an invalid or inaccessible document ID.
    useSocket(documentStatus === "ready", documentId);

    // Stable upload function for this workspace+document pair. Null fallbacks are safe —
    // the editor is not created until both are present, so the fallbacks never reach ImageKit.
    const uploadFile = useUploadFile(docWorkspace?.id ?? 0, documentId ?? "");

    // Created once per document (yDoc changes on switch). Gated on docWorkspace and
    // documentId so uploadFile always has the correct folder path when first created.
    const editor = useMemo(() => {
        if (!docWorkspace || !documentId) return null;

        return BlockNoteEditor.create({
            schema: editorSchema,
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
                    // inside a code block, paste as plain text so markdown syntax isn't interpreted
                    const { block } = e.getTextCursorPosition();
                    if (block.type === "codeBlock")
                        return defaultPasteHandler();

                    e.pasteMarkdown(event.clipboardData.getData("text/plain"));
                    return true;
                }

                return defaultPasteHandler();
            },

            // Uploads a file and returns its public CDN URL; enables the Upload tab
            // on image/video/audio blocks and handles image pastes.
            uploadFile,

            // Registers the forward-delete (Delete key) merge behaviour that
            // BlockNote does not implement natively (Backspace merge works; Delete does not).
            extensions: [deleteBlockExtension],
        });
    }, [yDoc, docWorkspace, documentId, uploadFile]);

    useUndoManagerGuard(editor, yDoc);
    useEditorFocus(editor, documentId, documentStatus);

    return {
        editor,
        documentStatus,
        documentAccess,
        docWorkspace,
        title,
        handleTitleChange,
        isTitlePending,
        documentId,
    };
};

export default useEditor;
