import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import apiClient from "@/lib/http";
import { documentKeys } from "@/features/documents/queryKeys";
import type { SearchDocumentContentResponseDto } from "@converge/shared";

/**
 * Runs one ⌘K semantic search when the user presses ↵. Each run has its own
 * cache entry and is never refetched or retried on its own — every call is
 * a paid AI call that counts against the user's rate limit, so only an
 * explicit ↵ may make one.
 * @param workspaceId - the workspace to search
 * @param run - the submitted query and its run number, or null before the first ↵
 * @returns the matching documents and the run's status: "idle" before any
 * run, "rateLimited" on a 429, "failed" on any other error
 */
const useSemanticSearch = (
    workspaceId: number,
    run: { query: string; runId: number } | null,
) => {
    const { data, isPending, error } = useQuery({
        queryKey: documentKeys.semanticSearch(
            workspaceId,
            run?.query ?? "",
            run?.runId ?? 0,
        ),
        queryFn: async () => {
            const { data } =
                await apiClient.get<SearchDocumentContentResponseDto>(
                    "/document/search/content",
                    {
                        params: {
                            workspaceId,
                            query: run?.query,
                            mode: "semantic",
                        },
                    },
                );
            return data.documents;
        },
        enabled: run !== null && workspaceId !== 0,
        retry: false,
        // Never stale, so a window refocus or remount can't re-run it; and
        // dropped once unused, since a repeated query always runs again.
        staleTime: Infinity,
        gcTime: 0,
    });

    let status: "idle" | "loading" | "rateLimited" | "failed" | "done";
    if (run === null) {
        status = "idle";
    } else if (isAxiosError(error) && error.response?.status === 429) {
        status = "rateLimited";
    } else if (error) {
        status = "failed";
    } else if (isPending) {
        status = "loading";
    } else {
        status = "done";
    }

    return { documents: data ?? [], status };
};

export default useSemanticSearch;
