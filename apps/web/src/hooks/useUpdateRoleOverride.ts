import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../lib/http";
import { accessKeys } from "../queries/access";
import { documentKeys } from "../queries/documents";
import type {
    DocumentAccessLevel,
    GetDocumentRoleOverridesResponseDto,
    UpdateDocumentRoleOverridesResponseDto,
} from "@converge/shared";

/**
 * Sets or resets one role's access override on a document via PUT
 * /document-access/:id/role-overrides, and writes the server's resulting
 * overrides into the cache. The people list (each person's fallback level)
 * and the caller's own access may change with it, so those re-fetch. A
 * failure shows the global error toast.
 * @param documentId - the document being shared
 */
const useUpdateRoleOverride = (documentId: number) => {
    const queryClient = useQueryClient();

    const { mutate, isPending, variables } = useMutation({
        mutationFn: async ({
            field,
            value,
        }: {
            field: keyof UpdateDocumentRoleOverridesResponseDto;
            value: DocumentAccessLevel | null;
        }) => {
            const { data } =
                await apiClient.put<UpdateDocumentRoleOverridesResponseDto>(
                    `/document-access/${documentId}/role-overrides`,
                    { [field]: value },
                );
            return data;
        },
        meta: { errorMessage: "Couldn't change general access" },
        onSuccess: (data) => {
            queryClient.setQueryData<GetDocumentRoleOverridesResponseDto>(
                accessKeys.roleOverrides(documentId),
                (old) => old && { ...old, ...data },
            );
            queryClient.invalidateQueries({
                queryKey: accessKeys.list(documentId),
            });
            queryClient.invalidateQueries({
                queryKey: documentKeys.detail(documentId),
            });
        },
    });

    return {
        // value null resets the role to the workspace default
        updateRoleOverride: (
            field: keyof UpdateDocumentRoleOverridesResponseDto,
            value: DocumentAccessLevel | null,
        ) => mutate({ field, value }),
        savingRole: isPending ? variables.field : null, // the role whose change is in flight
    };
};

export default useUpdateRoleOverride;
