import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import * as Y from "yjs";
import useSyncEditorChanges from "../hooks/useSyncEditorChanges";
import usePing from "../hooks/usePing";
import AuthOverlay from "../components/AuthOverlay";
import Navbar from "../components/Navbar";
import DocumentTitle from "../components/DocumentTitle";
import NotFoundPage from "./NotFoundPage";

// EditorPage: collaborative editor for a single document identified by URL param.
// Creates a Y.Doc scoped to this mount so each document gets independent Yjs state.
// Passes documentId to useSyncEditorChanges for per-document IndexedDB persistence
// and to gate sync operations until the server confirms the room join.
// All hooks are called unconditionally (React rules); invalid IDs render NotFoundPage.
function EditorPage() {
    const { documentId: documentIdStr } = useParams<{ documentId: string }>();
    const documentId = parseInt(documentIdStr ?? "", 10);
    const isValidDocumentId = Number.isInteger(documentId) && documentId >= 1;

    // Y.Doc is created once per mount and scoped to this document.
    // useState lazy initializer ensures a stable instance across re-renders.
    const [yDoc] = useState(() => new Y.Doc());

    // Hooks are always called — React requires unconditional hook invocation.
    // For invalid IDs, join_doc is rejected by the server so no sync occurs.
    const { title, isDocJoined } = useSyncEditorChanges(yDoc, isValidDocumentId ? documentId : -1);
    usePing();

    const editor = useCreateBlockNote({
        // Bind the editor to the Yjs XML fragment — the shared data structure BlockNote
        // uses internally. "blocknote" is the established key convention.
        // `as any` works around a typing gap in BlockNote's collaboration option.
        collaboration: {
            fragment: yDoc.getXmlFragment("blocknote"),
        } as any,

        // Intercept plain-text pastes and treat them as markdown.
        // Lets AI-generated markdown paste as formatted blocks instead of raw text.
        pasteHandler: ({ event, editor, defaultPasteHandler }) => {
            if (event.clipboardData?.types.includes("text/plain")) {
                editor.pasteMarkdown(event.clipboardData.getData("text/plain"));
                return true;
            }
            return defaultPasteHandler();
        },
    });

    if (!isValidDocumentId) {
        return <NotFoundPage />;
    }

    return (
        // Full-screen column: fixed header + scrollable editor area below
        <div className="flex flex-col h-screen bg-[#1f1f1f] gap-2">
            <AuthOverlay />
            <Navbar />

            {/* Scrollable area: title above editor, both share the same scroll container */}
            <div className="flex-1 overflow-auto flex flex-col">
                <DocumentTitle documentId={documentId} title={title} isDocJoined={isDocJoined} />
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
