import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import apiClient from "@/lib/http";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import { documentKeys } from "@/features/documents/queryKeys";
import type {
    GetDocumentResponseDto,
    LibraryDocumentDto,
} from "@converge/shared";

/** A document as the pin toggle gets it: a full list row, or just id and title (the editor). */
type PinDocument = LibraryDocumentDto | { id: number; title: string };

/**
 * Pins or unpins a document for the user via PUT /document/:id/pin. The pin
 * flips at once (optimistic): the open document's isPinned, and the
 * sidebar's Pinned and Recent lists, which are complements of each other
 * (ignorePinnedDocs). A document pinned from the editor has no list row to
 * add, so it joins Pinned when the lists re-fetch. A failure puts everything
 * back and shows the global error toast.
 */
const useTogglePin = () => {
    const queryClient = useQueryClient();
    const currentWorkspace = useAtomValue(currentWorkspaceAtom);
    const workspaceId = currentWorkspace?.id ?? 0;

    const { mutate } = useMutation({
        mutationFn: async ({
            doc,
            pinned,
        }: {
            doc: PinDocument;
            pinned: boolean;
        }) => {
            await apiClient.put(`/document/${doc.id}/pin`, { pinned });
        },
        meta: {
            errorMessage: ({ pinned }: { pinned: boolean }) =>
                pinned
                    ? "Couldn't pin the document"
                    : "Couldn't unpin the document",
        },
        onMutate: async ({ doc, pinned }) => {
            const detailKey = documentKeys.detail(doc.id);
            const pinnedKey = documentKeys.pinned(workspaceId);
            const recentKey = documentKeys.recent(workspaceId);
            await Promise.all(
                [detailKey, pinnedKey, recentKey].map((queryKey) =>
                    queryClient.cancelQueries({ queryKey }),
                ),
            );
            const previous = {
                detail: queryClient.getQueryData(detailKey),
                pinned: queryClient.getQueryData(pinnedKey),
                recent: queryClient.getQueryData(recentKey),
            };

            const isOther = (d: LibraryDocumentDto) => d.id !== doc.id;
            queryClient.setQueryData<GetDocumentResponseDto>(
                detailKey,
                (old) => old && { ...old, isPinned: pinned },
            );
            queryClient.setQueryData<LibraryDocumentDto[]>(pinnedKey, (list) =>
                !pinned
                    ? list?.filter(isOther)
                    : list && "access" in doc
                      ? [doc, ...list.filter(isOther)]
                      : list,
            );
            if (pinned)
                queryClient.setQueryData<LibraryDocumentDto[]>(
                    recentKey,
                    (list) => list?.filter(isOther),
                );
            return { previous, detailKey, pinnedKey, recentKey };
        },
        onError: (_error, _variables, context) => {
            if (!context) return;
            queryClient.setQueryData(
                context.detailKey,
                context.previous.detail,
            );
            queryClient.setQueryData(
                context.pinnedKey,
                context.previous.pinned,
            );
            queryClient.setQueryData(
                context.recentKey,
                context.previous.recent,
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
        },
    });

    return {
        togglePin: (doc: PinDocument, pinned: boolean) =>
            mutate({ doc, pinned }), // true to pin, false to unpin
    };
};

export default useTogglePin;
