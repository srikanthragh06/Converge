import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { currentWorkspaceAtom, refreshSidebarAtom } from "../atoms/workspace";
import apiClient from "../lib/http";
import type { CreateDocumentResponseDto } from "@converge/shared";

/**
 * Returns a createDocument function that POST /document with the current
 * workspace ID and navigates to the new document's editor page. Tracks
 * isCreating to prevent double-submission.
 */
const useNewDocument = () => {
    const navigate = useNavigate();
    const currentWorkspace = useAtomValue(currentWorkspaceAtom); // used to scope the new document to the current workspace
    const refreshSidebar = useSetAtom(refreshSidebarAtom); // increments to tell the sidebar to refetch
    const [isCreating, setIsCreating] = useState(false); // true while the POST is in flight

    /**
     * Creates a new document in the current workspace and navigates to the
     * editor. No-ops if a create is already in flight or no workspace is set.
     */
    const createDocument = useCallback(async () => {
        if (isCreating || !currentWorkspace) return;
        try {
            setIsCreating(true);
            const { data } = await apiClient.post<CreateDocumentResponseDto>(
                "/document",
                {
                    workspaceId: currentWorkspace.id,
                },
            );
            refreshSidebar((c) => c + 1);
            navigate(`/document/${data.documentId}`);
        } catch (err) {
            console.error("useNewDocument: failed to create document", err);
        } finally {
            setIsCreating(false);
        }
    }, [isCreating, currentWorkspace, navigate]);

    return { createDocument, isCreating };
};

export default useNewDocument;
