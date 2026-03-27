import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useMemo } from "react";
import { convergeTheme } from "../../theme/editorTheme";

const DocPage = () => {
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

    return (
        <div className="w-screen h-screen flex flex-col">
            <div className="flex-1">
                <BlockNoteView
                    editor={editor}
                    theme={convergeTheme}
                    className="h-full"
                />
            </div>
        </div>
    );
};

export default DocPage;
