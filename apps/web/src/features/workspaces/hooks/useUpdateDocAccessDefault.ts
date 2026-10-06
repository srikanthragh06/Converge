import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { documentKeys } from "@/features/documents/queryKeys";
import { workspaceKeys } from "@/features/workspaces/queryKeys";
import type {
    DocumentAccessLevel,
    GetWorkspaceDocAccessDefaultsResponseDto,
} from "@converge/shared";

/**
 * Changes one role's default document access via PATCH
 * /workspaces/:id/doc-access-defaults. The dropdown changes at once
 * (optimistic) and goes back if the request fails, which also shows the
 * global error toast. On success the document lists re-fetch, since each
 * row's resolved access may have changed.
 * @param workspaceId - the workspace being configured
 */
const useUpdateDocAccessDefault = (workspaceId: number) => {
    const queryClient = useQueryClient();
    const key = workspaceKeys.docAccessDefaults(workspaceId);

    const { mutate, isPending } = useMutation({
        mutationFn: async ({
            field,
            value,
        }: {
            field: keyof GetWorkspaceDocAccessDefaultsResponseDto;
            value: DocumentAccessLevel;
        }) => {
            await apiClient.patch(
                `/workspaces/${workspaceId}/doc-access-defaults`,
                { [field]: value },
            );
        },
        meta: { errorMessage: "Couldn't change the default access" },
        onMutate: async ({ field, value }) => {
            await queryClient.cancelQueries({ queryKey: key });
            const previous =
                queryClient.getQueryData<GetWorkspaceDocAccessDefaultsResponseDto>(
                    key,
                );
            queryClient.setQueryData<GetWorkspaceDocAccessDefaultsResponseDto>(
                key,
                (old) => old && { ...old, [field]: value },
            );
            return { previous };
        },
        onError: (_error, _variables, context) => {
            queryClient.setQueryData(key, context?.previous);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: documentKeys.all });
        },
    });

    return {
        updateDefault: (
            field: keyof GetWorkspaceDocAccessDefaultsResponseDto,
            value: DocumentAccessLevel,
        ) => mutate({ field, value }),
        isSaving: isPending, // true while a change is being saved
    };
};

export default useUpdateDocAccessDefault;
