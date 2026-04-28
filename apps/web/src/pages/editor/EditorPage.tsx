import { useState, useEffect } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "../../theme/editorTheme";
import useEditor from "../../hooks/useEditor";
import Page from "../../components/Page";
import DocumentSwitcherOverlay from "./components/DocumentSwitcherOverlay";
import EditorPageHeader from "./components/EditorPageHeader";
import AnimatedDots from "../../components/AnimatedDots";

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
        title,
        handleTitleChange,
        isTitlePending,
    } = useEditor(); // editor instance, document ID, fetch status, and title state
    const [isSwitcherOpen, setIsSwitcherOpen] = useState(false); // controls document switcher overlay visibility

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
        <Page authRequired>
            {/* EditorPageHeader is sticky at top-0; title bar sticks independently below it */}
            <EditorPageHeader
                documentStatus={documentStatus}
                documentId={documentId}
            />
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
                        className={`mx-2 w-full max-w-2xl min-w-0
                            bg-transparent border-none outline-none
                            text-text-primary font-bold sm:text-4xl text-2xl
                            placeholder-text-disabled transition-opacity duration-200
                            ${isTitlePending ? "opacity-50" : "opacity-100"}`}
                    />
                </div>
            )}

            {/* Loading state — shown while the document is being fetched */}
            {documentStatus === "loading" && (
                <div className="w-full h-full flex justify-center items-center">
                    <p className="text-text-secondary">
                        <span>Loading</span>
                        <AnimatedDots />
                    </p>
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

            {/* Ready state — document loaded successfully; render the editor */}
            {documentStatus === "ready" && (
                <BlockNoteView
                    editor={editor}
                    theme={convergeTheme}
                    className="h-full"
                />
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
