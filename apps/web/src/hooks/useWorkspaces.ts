import { useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { currentWorkspaceAtom } from "../atoms/sidebar";
import apiClient from "../lib/http";
import type {
    GetWorkspacesResponseDto,
    SearchWorkspacesResponseDto,
    WorkspaceDto,
} from "@converge/shared";

/**
 * Manages workspaces page state. Fetches workspaces from GET /workspaces
 * and switches to the search endpoint with debounce when the user types.
 */
const useWorkspaces = () => {
    const setCurrentWorkspace = useSetAtom(currentWorkspaceAtom); // Sets the sidebar's selected workspace.
    const [searchText, setSearchText] = useState(""); // Current search query text.
    const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]); // Fetched workspace list.
    const [isLoading, setIsLoading] = useState(false); // Whether a fetch is in progress.

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const { data } =
                await apiClient.get<GetWorkspacesResponseDto>("/workspaces");
            setWorkspaces(data.workspaces);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSearch = async (query: string) => {
        setIsLoading(true);
        try {
            const { data } = await apiClient.get<SearchWorkspacesResponseDto>(
                "/workspaces/search",
                { params: { q: query } },
            );
            setWorkspaces(data.workspaces);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    // Debounced search — fires 300ms after the user stops typing.
    // Resets to the full list when the query is cleared.
    useEffect(() => {
        if (searchText.trim() === "") {
            fetchAll();
        } else {
            const timeout = setTimeout(
                () => fetchSearch(searchText.trim()),
                300,
            );
            return () => clearTimeout(timeout);
        }
    }, [searchText]);

    /**
     * Selects a workspace via PUT /workspaces/:id/select, updates the sidebar
     * current workspace, and flips the isSelected flag locally so all cards
     * reflect the change without refetching.
     */
    const selectWorkspace = async (id: number) => {
        try {
            const { data } = await apiClient.put<{ id: number; name: string }>(
                `/workspaces/${id}/select`,
            );
            setCurrentWorkspace(data);
            // Toggle selection locally — the server response bumps last_visited_at
            // so a refetch would reorder cards.
            setWorkspaces((prev) =>
                prev.map((w) => ({ ...w, isSelected: w.id === id })),
            );
        } catch (err) {
            console.error("Failed to select workspace", err);
        }
    };

    return {
        searchText,
        setSearchText,
        workspaces,
        isLoading,
        fetchAll,
        fetchSearch,
        selectWorkspace,
    };
};

export default useWorkspaces;
