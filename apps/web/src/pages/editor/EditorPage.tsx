import { useRef } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "../../theme/editorTheme";
import useEditor from "../../hooks/useEditor";
import Page from "../../components/Page";
import DocumentSwitcherOverlay from "./documentSwitcherOverlay/DocumentSwitcherOverlay";
import EditorPageHeader from "./header/EditorPageHeader";
import BlockAwarenessOverlay from "./blockAwarenessOverlay/BlockAwarenessOverlay";
import { hasAccess } from "../../utils/utils";
import useEditorScrollGap from "../../hooks/useEditorScrollGap";
import useDocumentSwitcherShortcut from "../../hooks/useDocumentSwitcherShortcut";
import { Skeleton } from "primereact/skeleton";
import { useAtomValue } from "jotai";
import DelayedRender from "../../components/DelayedRender";
import { isSocketReadyAtom, syncStatusAtom } from "@/atoms/socket";

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
        docWorkspace,
        title,
        handleTitleChange,
        isTitlePending,
    } = useEditor(); // editor instance, document ID, fetch status, title state, and resolved access level

    const isSocketReady = useAtomValue(isSocketReadyAtom); // true only after DOC_READY — gates editor render so it never mounts before the socket handshake completes
    const scrollRef = useEditorScrollGap(editor); // ref for the scroll container — maintains a gap below the last block
    const editorWrapperRef = useRef<HTMLDivElement>(null); // ref for the position:relative wrapper used by BlockAwarenessOverlay
    const isEditable =
        documentAccess !== null && hasAccess(documentAccess, "editor"); // editor+ may write; viewers get a read-only instance

    const { isSwitcherOpen, setIsSwitcherOpen } = useDocumentSwitcherShortcut();

    const syncStatus = useAtomValue(syncStatusAtom); // current Yjs sync state — drives skeleton vs. editor rendering

    return (
        // authRequired redirects unauthenticated users before rendering children
        <Page authRequired haveSidebar>
            {documentStatus === "ready" && (
                <EditorPageHeader
                    documentStatus={documentStatus}
                    documentId={documentId}
                    workspaceName={docWorkspace?.name ?? null}
                    title={title}
                />
            )}
            {/* Forbidden state — shown when the user lacks access to this document */}
            {documentStatus === "forbidden" && (
                <div className="flex-1 w-full flex justify-center items-center">
                    <p className="text-text-secondary">
                        You don&apos;t have access to this document.
                    </p>
                </div>
            )}

            {/* Loading/ready state — unified scroll container so title and editor scroll together */}
            {(documentStatus === "loading" || documentStatus === "ready") && (
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                    {/* Title: skeleton while loading, real input when ready */}
                    <div className="w-full flex justify-start sm:pl-8 pl-4 pr-2 py-2 sm:mt-4 mt-2">
                        {documentStatus === "loading" ? (
                            <DelayedRender>
                                <div className="mx-2 w-full max-w-2xl flex flex-col gap-4">
                                    <Skeleton height="2.5rem" width="45%" />
                                    <Skeleton height="6rem" width="100%" />
                                    <Skeleton height="4rem" width="100%" />
                                    <Skeleton height="5rem" width="100%" />
                                </div>
                            </DelayedRender>
                        ) : (
                            <input
                                type="text"
                                placeholder="Untitled"
                                maxLength={32}
                                size={1}
                                value={title}
                                onChange={(e) =>
                                    handleTitleChange(e.target.value)
                                }
                                disabled={!isEditable}
                                className={`mx-2 w-full max-w-2xl min-w-0
                                    bg-transparent border-none outline-none
                                    text-text-primary font-bold sm:text-4xl text-2xl
                                    placeholder-text-disabled transition-opacity duration-200
                                    disabled:cursor-default
                                    ${isTitlePending ? "opacity-50" : "opacity-100"}`}
                            />
                        )}
                    </div>

                    {/* Editor: a few large skeletons while restoring, real editor when synced */}
                    {(syncStatus === "restoring" || !isSocketReady) && (
                        <DelayedRender>
                            <div className="sm:pl-14 pl-6 pr-4 max-w-2xl mt-2 flex flex-col gap-4">
                                <Skeleton height="6rem" width="100%" />
                                <Skeleton height="4rem" width="100%" />
                                <Skeleton height="5rem" width="100%" />
                            </div>
                        </DelayedRender>
                    )}
                    {editor && syncStatus !== "restoring" && isSocketReady && (
                        <div ref={editorWrapperRef} className="relative">
                            <BlockNoteView
                                editor={editor}
                                theme={convergeTheme}
                                editable={isEditable}
                            />
                            <BlockAwarenessOverlay
                                editorWrapperRef={editorWrapperRef}
                            />
                        </div>
                    )}
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
