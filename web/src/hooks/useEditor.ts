import { BlockNoteEditor } from "@blocknote/core";
import { useMemo } from "react";
import * as Y from "yjs";

const useEditor = () => {
    const yDoc = useMemo(() => new Y.Doc(), []);

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
    }, []);

    return { editor };
};

export default useEditor;
