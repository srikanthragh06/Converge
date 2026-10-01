import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/http";
import { documentKeys } from "../queries/documents";

/**
 * Restores a trashed document via POST /document/:id/restore, then refreshes
 * every document list (sidebar, Library, Trash, ⌘K). It stays pending until
 * they have re-fetched, so the restored row leaves Trash as the spinner
 * stops. A failure shows the global error toast.
 * @param onSuccess - called with the restored document, e.g. to show a toast.
 *                    Runs even if the caller has unmounted since (an Undo
 *                    toast outlives the menu that trashed the document).
 */
const useRestoreDocument = ({
    onSuccess,
}: {
    onSuccess: (doc: { id: number; title: string }) => void;
}) => {
    const queryClient = useQueryClient();

    const { mutate, isPending, variables } = useMutation({
        mutationFn: async (doc: { id: number; title: string }) => {
            await apiClient.post(`/document/${doc.id}/restore`);
        },
        meta: { errorMessage: "Couldn't restore the document" },
        onSuccess: (_data, doc) => {
            onSuccess(doc);
            return queryClient.invalidateQueries({
                queryKey: documentKeys.lists(),
            });
        },
    });

    return {
        restoreDocument: mutate, // sends the restore request
        restoringId: isPending ? variables.id : null, // the document being restored, if any
    };
};

export default useRestoreDocument;
