import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { accessKeys } from "@/features/documents/share/queryKeys";
import type {
    DocumentAccessLevel,
    FindNewDocumentAccessUserResponseDto,
} from "@converge/shared";

/**
 * Gives a looked-up person direct access to a document with the chosen level
 * via PUT /document-access/:id/user/:userId. On success it refreshes the
 * people list and the "add person" lookups (an old "found" result is now
 * stale), then calls onSuccess. A failure shows the global error toast.
 * @param documentId - the document being shared
 * @param onSuccess - called after a successful add
 */
const useAddDocumentAccess = (
    documentId: number,
    { onSuccess }: { onSuccess: () => void },
) => {
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async ({
            user,
            access,
        }: {
            user: FindNewDocumentAccessUserResponseDto;
            access: DocumentAccessLevel;
        }) => {
            await apiClient.put(
                `/document-access/${documentId}/user/${user.id}`,
                { access },
            );
        },
        meta: {
            errorMessage: ({
                user,
            }: {
                user: FindNewDocumentAccessUserResponseDto;
            }) => `Couldn't add ${user.name}`,
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: accessKeys.list(documentId),
            });
            queryClient.invalidateQueries({
                queryKey: accessKeys.newUserLookups(documentId),
            });
            onSuccess();
        },
    });

    return {
        addPerson: (
            user: FindNewDocumentAccessUserResponseDto,
            access: DocumentAccessLevel,
        ) => mutate({ user, access }), // sends the add request
        isAdding: isPending, // true while the add request is in flight
    };
};

export default useAddDocumentAccess;
