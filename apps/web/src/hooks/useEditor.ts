import { BlockNoteEditor } from "@blocknote/core";
import { useMemo } from "react";
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

    const { documentStatus } = useDocumentFetch(documentId, setTitle);

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

    return { editor, documentStatus, title, handleTitleChange, isTitlePending };
};

export default useEditor;
