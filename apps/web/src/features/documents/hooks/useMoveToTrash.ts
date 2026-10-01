import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { documentKeys } from "@/features/documents/queryKeys";

/**
 * Soft-deletes a document via DELETE /document/:id (admin access required),
 * then refreshes every document list and calls onSuccess. A failure shows
 * the global error toast.
 * @param onSuccess - called with the trashed document, e.g. to leave its
 *                    editor and show an Undo toast
 */
const useMoveToTrash = ({
    onSuccess,
}: {
    onSuccess: (doc: { id: number; title: string }) => void;
}) => {
    const queryClient = useQueryClient();

    const { mutate } = useMutation({
        mutationFn: async (doc: { id: number; title: string }) => {
            await apiClient.delete(`/document/${doc.id}`);
        },
        meta: { errorMessage: "Couldn't move the document to Trash" },
        onSuccess: (_data, doc) => {
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
            onSuccess(doc);
        },
    });

    return { moveToTrash: mutate };
};

export default useMoveToTrash;
