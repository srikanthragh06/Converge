import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "../../theme/editorTheme";
import useEditor from "../../hooks/useEditor";
import Page from "../../components/Page";

/**
 * Full-screen editor page. Fetches the document by ID from the URL, redirects
 * to /404 if not found, shows a forbidden message if the user lacks access,
 * then mounts the BlockNote editor once the document is confirmed.
 */
const EditorPage = () => {
    const { editor, documentStatus } = useEditor(); // BlockNote editor instance wired to the shared Yjs doc

    return (
        <Page authRequired>
            {documentStatus === "loading" && (
                <div className="w-full h-full flex justify-center items-center">
                    <p className="text-text-secondary">Loading doc...</p>
                </div>
            )}
            {documentStatus === "forbidden" && (
                <div className="w-full h-full flex justify-center items-center">
                    <p className="text-text-secondary">
                        You don&apos;t have access to this document.
                    </p>
                </div>
            )}
            {documentStatus === "ready" && (
                <div className="flex-1">
                    <BlockNoteView
                        editor={editor}
                        theme={convergeTheme}
                        className="h-full"
                    />
                </div>
            )}
        </Page>
    );
};

export default EditorPage;
