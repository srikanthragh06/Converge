import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "../../theme/editorTheme";
import useEditor from "../../hooks/useEditor";
import Page from "../../components/Page";

/**
 * Full-screen editor page. Mounts the BlockNote editor with the Converge
 * theme and fills the entire viewport.
 */
const EditorPage = () => {
    const { editor } = useEditor(); // BlockNote editor instance wired to the shared Yjs doc

    return (
        <Page>
            <div className="flex-1">
                <BlockNoteView
                    editor={editor}
                    theme={convergeTheme}
                    className="h-full"
                />
            </div>
        </Page>
    );
};

export default EditorPage;
