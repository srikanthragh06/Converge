import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import apiClient from "../lib/http";
import { pinOverridesAtom } from "../atoms/sidebar";
import { documentKeys } from "../queries/documents";

/**
 * Pins or unpins a document for the user via PUT /document/:id/pin, then
 * records the new state in pinOverridesAtom (so the editor's ⋯ menu follows
 * it) and refreshes the document lists — pinned and recent are complements
 * of each other (ignorePinnedDocs), so both re-fetch to move the document
 * across. A failure shows the global error toast.
 */
const useTogglePin = () => {
    const queryClient = useQueryClient();
    const setPinOverrides = useSetAtom(pinOverridesAtom);

    const { mutate } = useMutation({
        mutationFn: async ({
            documentId,
            pinned,
        }: {
            documentId: number;
            pinned: boolean;
        }) => {
            await apiClient.put(`/document/${documentId}/pin`, { pinned });
        },
        meta: {
            errorMessage: ({ pinned }: { pinned: boolean }) =>
                pinned
                    ? "Couldn't pin the document"
                    : "Couldn't unpin the document",
        },
        onSuccess: (_data, { documentId, pinned }) => {
            setPinOverrides((prev) => ({ ...prev, [documentId]: pinned }));
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        },
    });

    return {
        togglePin: (documentId: number, pinned: boolean) =>
            mutate({ documentId, pinned }), // true to pin, false to unpin
    };
};

export default useTogglePin;
