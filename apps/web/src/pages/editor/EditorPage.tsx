import { useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "../../theme/editorTheme";
import useEditor from "../../hooks/useEditor";
import Page from "../../components/Page";
import DocumentSwitcherOverlay from "./documentSwitcherOverlay/DocumentSwitcherOverlay";
import EditorPageHeader from "./header/EditorPageHeader";
import AnimatedDots from "../../components/AnimatedDots";
import { hasAccess } from "../../utils/utils";
import useEditorScrollGap from "../../hooks/useEditorScrollGap";
import useDocumentSwitcherShortcut from "../../hooks/useDocumentSwitcherShortcut";

/**
 * Full-screen editor page. Fetches the document by ID from the URL, redirects
 * to /404 if not found, shows a forbidden message if the user lacks access,
 * then mounts the BlockNote editor once the document is confirmed.
 */
const EditorPage = () => {
    const {
        documentId,
        editor,
        documentStatus,
        documentAccess,
        title,
        handleTitleChange,
        isTitlePending,
    } = useEditor(); // editor instance, document ID, fetch status, title state, and resolved access level
    const [isSwitcherOpen, setIsSwitcherOpen] = useState(false); // controls document switcher overlay visibility
    const scrollRef = useEditorScrollGap(editor); // ref for the scroll container — maintains a gap below the last block
    const isEditable =
        documentAccess !== null && hasAccess(documentAccess, "editor"); // editor+ may write; viewers get a read-only instance

    useDocumentSwitcherShortcut(setIsSwitcherOpen);

    return (
        // authRequired redirects unauthenticated users before rendering children
        <Page authRequired haveSidebar>
            {documentStatus === "ready" && (
                <EditorPageHeader
                    documentStatus={documentStatus}
                    documentId={documentId}
                />
            )}
            {/* Loading state — shown while the document is being fetched */}
            {documentStatus === "loading" && (
                <div className="flex-1 w-full flex justify-center items-center">
                    <p className="text-text-secondary">
                        <span>Loading</span>
                        <AnimatedDots />
                    </p>
                </div>
            )}

            {/* Forbidden state — shown when the user lacks access to this document */}
            {documentStatus === "forbidden" && (
                <div className="flex-1 w-full flex justify-center items-center">
                    <p className="text-text-secondary">
                        You don&apos;t have access to this document.
                    </p>
                </div>
            )}

            {/* Ready state — title and editor scroll together in one container */}
            {documentStatus === "ready" && (
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                    <div className="w-full flex justify-start sm:pl-8 pl-4 pr-2 py-2 sm:mt-4 mt-2">
                        {/* Dims to 50% opacity while a title save is in-flight */}
                        <input
                            type="text"
                            placeholder="Untitled"
                            maxLength={32}
                            size={1}
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            disabled={!isEditable}
                            className={`mx-2 w-full max-w-2xl min-w-0
                                bg-transparent border-none outline-none
                                text-text-primary font-bold sm:text-4xl text-2xl
                                placeholder-text-disabled transition-opacity duration-200
                                disabled:cursor-default
                                ${isTitlePending ? "opacity-50" : "opacity-100"}`}
                        />
                    </div>
                    <BlockNoteView
                        editor={editor}
                        theme={convergeTheme}
                        editable={isEditable}
                    />
                </div>
            )}
            {isSwitcherOpen && (
                <DocumentSwitcherOverlay
                    onClose={() => setIsSwitcherOpen(false)}
                    documentId={documentId}
                />
            )}
        </Page>
    );
};

export default EditorPage;
