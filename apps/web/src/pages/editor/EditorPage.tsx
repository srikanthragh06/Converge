import { useRef } from "react";
import { Navigate } from "react-router-dom";
import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "../../theme/editorTheme";
import useEditor from "../../hooks/useEditor";
import Page from "../../components/Page";
import MobileTopBar from "../../components/MobileTopBar";
import EditorPageHeader from "./header/EditorPageHeader";
import BlockAwarenessOverlay from "./blockAwarenessOverlay/BlockAwarenessOverlay";
import WriteLockBanner from "./writeLockBanner/WriteLockBanner";
import { hasAccess } from "../../utils/utils";
import useEditorScrollGap from "../../hooks/useEditorScrollGap";
import useWriteLock from "../../hooks/useWriteLock";
import useScrollToBlock from "../../hooks/useScrollToBlock";
import Skeleton from "../../components/ui/Skeleton";
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
        isPinned,
        title,
        handleTitleChange,
        isTitlePending,
    } = useEditor(); // editor instance, document ID, fetch status, title state, and resolved access level

    const isSocketReady = useAtomValue(isSocketReadyAtom); // true only after DOC_READY — gates editor render so it never mounts before the socket handshake completes
    const scrollRef = useEditorScrollGap(editor); // ref for the scroll container — maintains a gap below the last block
    const { isWriteLocked, toggleWriteLock } = useWriteLock(documentId); // local, per-user write lock toggle — has no effect on isEditable itself
    const editorWrapperRef = useRef<HTMLDivElement>(null); // ref for the position:relative wrapper used by BlockAwarenessOverlay
    const isEditable =
        documentAccess !== null && hasAccess(documentAccess, "editor"); // editor+ may write; viewers get a read-only instance
    const canWrite = isEditable && !isWriteLocked; // combines resolved access with the local write lock to gate actual editing

    const syncStatus = useAtomValue(syncStatusAtom); // current Yjs sync state — drives skeleton vs. editor rendering
    useScrollToBlock(documentId); // scrolls to a ?blockId= deep link once the editor's content first becomes visible

    return (
        // authRequired redirects unauthenticated users before rendering children
        // The editor header draws its own phone top bar once the document is ready.
        <Page authRequired haveSidebar>
            {documentStatus !== "ready" && <MobileTopBar />}
            {/* ready implies a numeric documentId (useDocumentFetch reports a missing one as notFound) */}
            {documentStatus === "ready" && documentId !== undefined && (
                <EditorPageHeader
                    documentStatus={documentStatus}
                    documentId={documentId}
                    workspaceName={docWorkspace?.name ?? null}
                    title={title}
                    editor={editor}
                    isEditable={isEditable}
                    isPinned={isPinned}
                    canTrash={
                        documentAccess !== null &&
                        hasAccess(documentAccess, "admin")
                    }
                    isWriteLocked={isWriteLocked}
                    onToggleWriteLock={toggleWriteLock}
                />
            )}
            {documentStatus === "notFound" && <Navigate to="/404" />}
            {/* Forbidden state — shown when the user lacks access to this document */}
            {documentStatus === "forbidden" && (
                <div className="flex-1 w-full flex justify-center items-center">
                    <p className="text-fg-secondary">
                        You don&apos;t have access to this document.
                    </p>
                </div>
            )}

            {/* Loading/ready state — unified scroll container so title and editor scroll together */}
            {(documentStatus === "loading" || documentStatus === "ready") && (
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                    {/* Centered document column: 880px of text, plus BlockNote's
                        side gutters (54px, where its drag handle sits; 20px on
                        phones), which the title and banner repeat so everything
                        lines up with the first character of the body. */}
                    <div className="mx-auto w-full max-w-[988px]">
                        <div className="px-5 pt-5 sm:px-[54px] sm:pt-[54px]">
                            {/* Write-lock notice — editor+ only, since locking needs write access */}
                            {documentStatus === "ready" &&
                                isEditable &&
                                isWriteLocked && (
                                    <WriteLockBanner
                                        onUnlock={toggleWriteLock}
                                        className="mb-4"
                                    />
                                )}
                            {/* Title: skeleton while loading, real input when ready */}
                            {documentStatus === "loading" ? (
                                <DelayedRender>
                                    <div className="flex flex-col gap-4">
                                        <Skeleton height="3rem" width="45%" />
                                        <Skeleton height="6rem" width="100%" />
                                        <Skeleton height="4rem" width="100%" />
                                        <Skeleton height="5rem" width="100%" />
                                    </div>
                                </DelayedRender>
                            ) : (
                                <input
                                    type="text"
                                    placeholder="Untitled"
                                    maxLength={256}
                                    size={1}
                                    value={title}
                                    onChange={(e) =>
                                        handleTitleChange(e.target.value)
                                    }
                                    disabled={!canWrite}
                                    className={`w-full min-w-0 border-none bg-transparent p-0 font-serif text-[34px] font-medium leading-[1.2] text-fg outline-none transition-opacity duration-200 placeholder-fg-muted disabled:cursor-default sm:text-[46px] ${isTitlePending ? "opacity-50" : "opacity-100"}`}
                                />
                            )}
                        </div>

                        {/* Editor: a few large skeletons while restoring, real editor when synced */}
                        {(syncStatus === "restoring" || !isSocketReady) && (
                            <DelayedRender>
                                <div className="mt-4 flex flex-col gap-4 px-5 sm:px-[54px]">
                                    <Skeleton height="6rem" width="100%" />
                                    <Skeleton height="4rem" width="100%" />
                                    <Skeleton height="5rem" width="100%" />
                                </div>
                            </DelayedRender>
                        )}
                        {/* BlockNoteView stays mounted once editor exists — unmounting it recreates the
                            UndoManager inside yUndoPlugin, which escapes the useUndoManagerGuard patch
                            and breaks undo/redo. CSS visibility hides it during the restore skeleton. */}
                        {editor && (
                            <div
                                ref={editorWrapperRef}
                                className={`relative mt-2 sm:mt-2.5 ${syncStatus === "restoring" || !isSocketReady ? "hidden" : ""}`}
                            >
                                <BlockNoteView
                                    editor={editor}
                                    theme={convergeTheme}
                                    editable={canWrite}
                                />
                                <BlockAwarenessOverlay
                                    editorWrapperRef={editorWrapperRef}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Page>
    );
};

export default EditorPage;
