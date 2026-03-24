import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import useSyncEditorChanges from "../../hooks/useSyncEditorChanges";
import usePing from "../../hooks/usePing";
import AuthOverlay from "../../components/overlay/AuthOverlay";
import DocumentNavbar from "./DocumentNavbar";
import DocumentTitle from "./DocumentTitle";
import DocSearchOverlay from "../../components/overlay/DocSearchOverlay";

// EditorPage: collaborative editor for a single document identified by URL param.
// The Y.Doc and BlockNote editor are owned by useSyncEditorChanges and are recreated
// whenever documentId changes — no component remount needed, and no stale Yjs state
// carries over between documents.
function EditorPage() {
    // Starts the socket ping/pong interval for RTT measurement.
    usePing();

    // Validation and navigation live inside useSyncEditorChanges — it reads the URL
    // param directly and redirects to /not-found if the ID is invalid.
    const {
        title,
        isDocJoined,
        isTitleSyncing,
        editor,
        documentId,
        isAccessForbidden,
        isEditorOrAbove,
    } = useSyncEditorChanges();

    // Server confirmed the user has no access row — show inline message instead of the editor.
    if (isAccessForbidden) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#1f1f1f] text-zinc-400">
                <p className="text-sm">
                    You don't have access to this document.
                </p>
            </div>
        );
    }

    return (
        // Full-screen column: fixed header + scrollable editor area below
        <div className="flex flex-col h-screen bg-[#1f1f1f] gap-2">
            <AuthOverlay />
            <DocSearchOverlay />
            <DocumentNavbar isDocJoined={isDocJoined} documentId={documentId} />

            {/* Scrollable area: title above editor, both share the same scroll container */}
            <div className="flex-1 overflow-auto flex flex-col">
                {/* Hidden until joined — title and editor only render after the server confirms the join */}
                {isDocJoined && documentId !== undefined && editor !== null && (
                    <>
                        <DocumentTitle
                            isEditorOrAbove={isEditorOrAbove}
                            title={title}
                            isTitleSyncing={isTitleSyncing}
                        />
                        <div className="flex-1">
                            <BlockNoteView
                                editor={editor}
                                theme="dark"
                                className="h-full"
                                editable={isEditorOrAbove}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default EditorPage;
