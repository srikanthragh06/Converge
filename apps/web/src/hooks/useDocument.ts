import { useQuery } from "@tanstack/react-query";
import apiClient from "../lib/http";
import { documentKeys } from "../queries/documents";
import type { GetDocumentResponseDto } from "@converge/shared";

/**
 * One document's own data from GET /document/id/:id: title, workspace, the
 * caller's resolved access, and whether they pinned it.
 * @param documentId - the document to load
 */
const useDocument = (documentId: number) => {
    const { data, isPending, error } = useQuery({
        queryKey: documentKeys.detail(documentId),
        queryFn: async () => {
            const { data } = await apiClient.get<GetDocumentResponseDto>(
                `/document/id/${documentId}`,
            );
            return data;
        },
    });

    return {
        document: data ?? null, // null until loaded, or if the load failed
        isLoading: isPending, // true until the first load settles
        error, // the failed load's error, e.g. a 403 or 404 axios error
    };
};

export default useDocument;
