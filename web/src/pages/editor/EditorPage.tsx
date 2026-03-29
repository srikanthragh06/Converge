import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "../../theme/editorTheme";
import useEditor from "../../hooks/useEditor";

const EditorPage = () => {
    const { editor } = useEditor();

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

export default EditorPage;
