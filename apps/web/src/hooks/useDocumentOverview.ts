import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/http";
import { documentKeys } from "../queries/documents";
import type { GetDocumentOverviewResponseDto } from "@converge/shared";

/**
 * A document's overview from GET /document/:id/overview: title, owner,
 * creator, created date, and search indexing status.
 * @param documentId - the document to describe
 * @param pollMs - re-fetch this often while mounted (e.g. to keep the
 *                 indexing status live); omit to load once
 */
const useDocumentOverview = (documentId: number, pollMs?: number) => {
    const { data, isPending } = useQuery({
        queryKey: documentKeys.overview(documentId),
        queryFn: async () => {
            const { data } =
                await apiClient.get<GetDocumentOverviewResponseDto>(
                    `/document/${documentId}/overview`,
                );
            return data;
        },
        refetchInterval: pollMs,
    });

    return {
        overview: data ?? null, // null while loading or on error
        isLoading: isPending, // true until the first load settles
    };
};

export default useDocumentOverview;
