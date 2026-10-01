import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { accessKeys } from "@/features/documents/share/queryKeys";
import type { GetDocumentAccessResponseDto } from "@converge/shared";

/**
 * Removes a person's direct access to a document via DELETE
 * /document-access/:id/user/:userId, so they fall back to their role's
 * general access. On success it drops them from the cached people list and
 * refreshes the "add person" lookups. A
 * failure shows the global error toast.
 * @param documentId - the document being shared
 */
const useRemoveDocumentAccess = (documentId: number) => {
    const queryClient = useQueryClient();

    const { mutate, isPending, variables } = useMutation({
        mutationFn: async (userId: number) => {
            await apiClient.delete(
                `/document-access/${documentId}/user/${userId}`,
            );
        },
        meta: { errorMessage: "Couldn't remove their access" },
        onSuccess: (_data, userId) => {
            queryClient.setQueryData<
                InfiniteData<GetDocumentAccessResponseDto>
            >(
                accessKeys.list(documentId),
                (list) =>
                    list && {
                        ...list,
                        pages: list.pages.map((page) => ({
                            ...page,
                            users: page.users.filter((u) => u.id !== userId),
                        })),
                    },
            );
            // An old "already has access" lookup for them is now stale.
            queryClient.invalidateQueries({
                queryKey: accessKeys.newUserLookups(documentId),
            });
        },
    });

    return {
        removeAccess: (userId: number) => mutate(userId), // sends the removal
        removingUserId: isPending ? variables : null, // person whose removal is in flight
    };
};

export default useRemoveDocumentAccess;
