import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useParams } from "react-router-dom";
import { BlockNoteView } from "@blocknote/mantine";
import useSyncEditorChanges from "../hooks/useSyncEditorChanges";
import usePing from "../hooks/usePing";
import AuthOverlay from "../components/AuthOverlay";
import Navbar from "../components/Navbar";
import DocumentTitle from "../components/DocumentTitle";
import NotFoundPage from "./NotFoundPage";

// EditorPage: collaborative editor for a single document identified by URL param.
// The Y.Doc and BlockNote editor are owned by useSyncEditorChanges and are recreated
// whenever documentId changes — no component remount needed, and no stale Yjs state
// carries over between documents.
function EditorPage() {
    const { documentId: documentIdStr } = useParams<{ documentId: string }>();
    const documentId = parseInt(documentIdStr ?? "", 10);
    const isValidDocumentId = Number.isInteger(documentId) && documentId >= 1;

    // Hooks are always called — React requires unconditional hook invocation.
    // For invalid IDs, join_doc is rejected by the server so no sync occurs.
    const { title, isDocJoined, isTitleSyncing, editor } = useSyncEditorChanges(
        isValidDocumentId ? documentId : -1,
    );
    usePing();


    if (!isValidDocumentId) {
        return <NotFoundPage />;
    }

    return (
        // Full-screen column: fixed header + scrollable editor area below
        <div className="flex flex-col h-screen bg-[#1f1f1f] gap-2">
            <AuthOverlay />
            <Navbar isDocJoined={isDocJoined} documentId={documentId} />

            {/* Scrollable area: title above editor, both share the same scroll container */}
            <div className="flex-1 overflow-auto flex flex-col">
                <DocumentTitle
                    documentId={documentId}
                    title={title}
                    isDocJoined={isDocJoined}
                    isTitleSyncing={isTitleSyncing}
                />
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
