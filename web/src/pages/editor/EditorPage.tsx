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
    // Validation and navigation live inside useSyncEditorChanges — it reads the URL
    // param directly and redirects to /not-found if the ID is invalid or access is denied.
    const { title, isDocJoined, isTitleSyncing, editor, documentId } =
        useSyncEditorChanges();
    usePing();

    return (
        // Full-screen column: fixed header + scrollable editor area below
        <div className="flex flex-col h-screen bg-[#1f1f1f] gap-2">
            <AuthOverlay />
            <DocSearchOverlay />
            <DocumentNavbar isDocJoined={isDocJoined} documentId={documentId} />

            {/* Scrollable area: title above editor, both share the same scroll container */}
            <div className="flex-1 overflow-auto flex flex-col">
                {/* Gated on documentId being parsed — avoids passing undefined to DocumentTitle */}
                {documentId !== undefined && (
                    <DocumentTitle
                        documentId={documentId}
                        title={title}
                        isDocJoined={isDocJoined}
                        isTitleSyncing={isTitleSyncing}
                    />
                )}
                <div className="flex-1">
                    <BlockNoteView
                        editor={editor}
                        theme="dark"
                        className="h-full"
                    />
                </div>
            </div>
        </div>
    );
}

export default EditorPage;
