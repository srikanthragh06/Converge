import { BlockNoteView } from "@blocknote/mantine";
import { convergeTheme } from "../../theme/editorTheme";
import useEditor from "../../hooks/useEditor";
import Page from "../../components/Page";
import useSocket from "../../hooks/useSocket";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "../../lib/http";
import { type GetDocumentResponseDto } from "@converge/shared";
import axios from "axios";

/**
 * Full-screen editor page. Fetches the document by ID from the URL, redirects
 * to /404 if not found, shows a forbidden message if the user lacks access,
 * then mounts the BlockNote editor once the document is confirmed.
 */
const EditorPage = () => {
    useSocket(); // initialise the Socket.io connection for the lifetime of this page

    const { documentId } = useParams<{ documentId: string }>(); // document ID from the URL path
    const navigate = useNavigate();
    const [documentStatus, setDocumentStatus] = useState<"loading" | "ready" | "forbidden" | "notFound">("loading"); // tracks the outcome of the document fetch

    const { editor } = useEditor(); // BlockNote editor instance wired to the shared Yjs doc

    // Fetches the document on mount — sets status or navigates to /404 based on the error code.
    useEffect(() => {
        const fetchDocument = async () => {
            try {
                await apiClient.get<GetDocumentResponseDto>(
                    `/document/${documentId}`,
                );
                setDocumentStatus("ready");
            } catch (err) {
                if (axios.isAxiosError(err) && err.response?.status === 403) {
                    setDocumentStatus("forbidden");
                } else {
                    navigate("/404");
                }
            }
        };

        fetchDocument();
    }, [documentId]);

    return (
        <Page authRequired className={documentStatus === "forbidden" ? "items-center justify-center" : ""}>
            {documentStatus === "forbidden" && (
                <p className="text-text-secondary">
                    You don&apos;t have access to this document.
                </p>
            )}
            {documentStatus === "ready" && (
                <div className="flex-1">
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
