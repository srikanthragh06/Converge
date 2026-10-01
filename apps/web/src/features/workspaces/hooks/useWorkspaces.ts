import { keepPreviousData, useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { workspaceKeys } from "@/features/workspaces/queryKeys";
import useDebouncedValue from "@/hooks/useDebouncedValue";
import useWorkspaceList from "./useWorkspaceList";
import type { SearchWorkspacesResponseDto } from "@converge/shared";

/**
 * The Workspaces page's list: every workspace while `search` is empty,
 * otherwise GET /workspaces/search results, 300ms after the user stops typing.
 * @param search - the filter text as typed
 */
const useWorkspaces = (search: string) => {
    const debouncedSearch = useDebouncedValue(search.trim(), 300);
    // Clearing the box shows the full list at once, without the debounce.
    const query = search.trim() === "" ? "" : debouncedSearch;
    const list = useWorkspaceList();

    const results = useQuery({
        queryKey: workspaceKeys.search(query),
        queryFn: async () => {
            const { data } = await apiClient.get<SearchWorkspacesResponseDto>(
                "/workspaces/search",
                { params: { q: query } },
            );
            return data.workspaces;
        },
        enabled: query !== "",
        // Keep the previous results on screen while the next search loads.
        placeholderData: keepPreviousData,
    });

    if (query === "")
        return { workspaces: list.workspaces, isLoading: list.isLoading };
    return {
        workspaces: results.data ?? list.workspaces, // the matches; the full list until the first search returns
        isLoading: results.isPending,
    };
};

export default useWorkspaces;
