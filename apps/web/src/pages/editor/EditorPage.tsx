import { useState, useEffect, useRef } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "../../theme/editorTheme";
import useEditor from "../../hooks/useEditor";
import Page from "../../components/Page";
import DocumentSwitcherOverlay from "./documentSwitcherOverlay/DocumentSwitcherOverlay";
import EditorPageHeader from "./header/EditorPageHeader";
import AnimatedDots from "../../components/AnimatedDots";
import { hasAccess } from "../../utils/utils";

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
    const scrollRef = useRef<HTMLDivElement>(null); // ref to the scrollable editor container
    const isEditable =
        documentAccess !== null && hasAccess(documentAccess, "editor"); // editor+ may write; viewers get a read-only instance

    // After every content change, if the cursor is near the bottom of the scroll
    // container, nudge the scroll down by 128px so there's always a gap below
    // the active block. ProseMirror's own scrollIntoView only ensures the cursor
    // is barely visible — it doesn't account for a trailing gap.
    useEffect(() => {
        if (!editor) return;
        return editor.onChange(() => {
            const container = scrollRef.current;
            if (!container) return;
            const gap = 128;
            const distanceFromBottom =
                container.scrollHeight -
                container.scrollTop -
                container.clientHeight;
            if (distanceFromBottom < gap) {
                container.scrollTop =
                    container.scrollHeight - container.clientHeight + gap;
            }
        });
    }, [editor]);

    // Opens the document switcher on Ctrl+P, preventing the browser print dialog.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "p") {
                e.preventDefault();
                setIsSwitcherOpen(true);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        // authRequired redirects unauthenticated users before rendering children
        <Page authRequired haveSidebar>
            {/* EditorPageHeader is sticky at top-0; title bar sticks independently below it */}

            {documentStatus === "ready" && (
                <EditorPageHeader
                    documentStatus={documentStatus}
                    documentId={documentId}
                />
            )}
            {documentStatus === "ready" && (
                <div className="sticky top-[52px] sm:top-[76px] z-40 bg-background-base w-full flex justify-start sm:pl-8 pl-4 pr-2 py-2 sm:mb-4 mb-2">
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

            {/* Ready state — only the editor scrolls; header and title stay fixed above */}
            {documentStatus === "ready" && (
                <div className="flex-1 overflow-y-auto">
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
