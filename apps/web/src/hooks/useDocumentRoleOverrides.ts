import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/http";
import { accessKeys } from "../queries/access";
import type { GetDocumentRoleOverridesResponseDto } from "@converge/shared";

/**
 * A document's per-role access overrides, with the workspace defaults they
 * override, from GET /document-access/:id/role-overrides. Shown as the Share
 * dialog's General access.
 * @param documentId - the document being shared
 */
const useDocumentRoleOverrides = (documentId: number) => {
    const { data, isPending } = useQuery({
        queryKey: accessKeys.roleOverrides(documentId),
        queryFn: async () => {
            const { data } =
                await apiClient.get<GetDocumentRoleOverridesResponseDto>(
                    `/document-access/${documentId}/role-overrides`,
                );
            return data;
        },
    });

    return {
        roleOverrides: data ?? null, // null while loading or on error
        isLoading: isPending, // true until the first load settles
    };
};

export default useDocumentRoleOverrides;
