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
    const { editor, documentStatus, title, handleTitleChange, isTitlePending } =
        useEditor(); // editor instance, document fetch status, and title state

    return (
        // authRequired redirects unauthenticated users before rendering children
        <Page authRequired>
            {/* Loading state — shown while the document is being fetched */}
            {documentStatus === "loading" && (
                <div className="w-full h-full flex justify-center items-center">
                    <p className="text-text-secondary">Loading doc...</p>
                </div>
            )}

            {/* Forbidden state — shown when the user lacks access to this document */}
            {documentStatus === "forbidden" && (
                <div className="w-full h-full flex justify-center items-center">
                    <p className="text-text-secondary">
                        You don&apos;t have access to this document.
                    </p>
                </div>
            )}

            {/* Ready state — document loaded successfully; render title input and editor */}
            {documentStatus === "ready" && (
                <div className="flex-1 flex flex-col">
                    {/* Title bar — inline editable document name above the editor canvas */}
                    <div
                        className="w-full flex justify-start px-2 py-2 overflow-hidden
                    sm:mb-4 mb-2"
                    >
                        {/* Dims to 50% opacity while a title save is in-flight */}
                        <input
                            type="text"
                            placeholder="Untitled"
                            maxLength={32}
                            size={1}
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            className={`mx-2 w-full max-w-2xl min-w-0
                            bg-transparent border-none outline-none
                            text-text-primary font-bold sm:text-4xl text-2xl
                            placeholder-text-disabled transition-opacity duration-200
                            ${isTitlePending ? "opacity-50" : "opacity-100"}`}
                        />
                    </div>

                    {/* BlockNote rich-text editor, fills remaining vertical space */}
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
