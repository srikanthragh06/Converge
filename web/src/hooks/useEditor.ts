import { BlockNoteEditor } from "@blocknote/core";
import { useMemo } from "react";

const useEditor = () => {
    const editor = useMemo(() => {
        return BlockNoteEditor.create({
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
