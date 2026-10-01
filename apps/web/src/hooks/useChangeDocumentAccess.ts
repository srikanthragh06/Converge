import {
    useMutation,
    useQueryClient,
    type InfiniteData,
} from "@tanstack/react-query";
import apiClient from "../lib/http";
import { accessKeys } from "../queries/access";
import type {
    DocumentAccessLevel,
    GetDocumentAccessResponseDto,
} from "@converge/shared";

/**
 * Changes a person's direct access to a document via PUT
 * /document-access/:id/user/:userId. On success it sets the new level in the
 * cached people list, so the dropdown doesn't flick back while a refetch
 * runs. A failure shows the global error toast.
 * @param documentId - the document being shared
 */
const useChangeDocumentAccess = (documentId: number) => {
    const queryClient = useQueryClient();

    const { mutate, isPending, variables } = useMutation({
        mutationFn: async ({
            userId,
            access,
        }: {
            userId: number;
            access: DocumentAccessLevel;
        }) => {
            await apiClient.put(
                `/document-access/${documentId}/user/${userId}`,
                { access },
            );
        },
        meta: { errorMessage: "Couldn't change their access" },
        onSuccess: (_data, { userId, access }) => {
            queryClient.setQueryData<
                InfiniteData<GetDocumentAccessResponseDto>
            >(
                accessKeys.list(documentId),
                (list) =>
                    list && {
                        ...list,
                        pages: list.pages.map((page) => ({
                            ...page,
                            users: page.users.map((u) =>
                                u.id === userId ? { ...u, access } : u,
                            ),
                        })),
                    },
            );
        },
    });

    return {
        changeAccess: (userId: number, access: DocumentAccessLevel) =>
            mutate({ userId, access }), // sends the change
        changingUserId: isPending ? variables.userId : null, // person whose change is in flight
    };
};

export default useChangeDocumentAccess;
