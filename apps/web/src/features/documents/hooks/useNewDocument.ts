import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import apiClient from "@/lib/http";
import { documentKeys } from "@/features/documents/queryKeys";
import type { CreateDocumentResponseDto } from "@converge/shared";

/**
 * Creates a document in the current workspace via POST /document, refreshes
 * the document lists, and opens the new document in the editor. A failure
 * shows the global error toast.
 */
const useNewDocument = () => {
    const navigate = useNavigate();
    const currentWorkspace = useAtomValue(currentWorkspaceAtom);
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async (workspaceId: number) => {
            const { data } = await apiClient.post<CreateDocumentResponseDto>(
                "/document",
                { workspaceId },
            );
            return data.documentId;
        },
        meta: { errorMessage: "Couldn't create a document" },
        onSuccess: (documentId) => {
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
            navigate(`/document/${documentId}`);
        },
    });

    return {
        // No-ops while a create is in flight or before the workspace loads.
        createDocument: () => {
            if (!isPending && currentWorkspace) mutate(currentWorkspace.id);
        },
        isCreating: isPending, // true while the create request is in flight
    };
};

export default useNewDocument;
