import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import apiClient from "@/lib/http";
import { showToast } from "@/lib/toast";
import { workspaceKeys } from "@/features/workspaces/queryKeys";
import type { WorkspaceOverviewResponseDto } from "@converge/shared";

/**
 * Renames a workspace via PATCH /workspaces/:id (admin+). On success it puts
 * the new name in the cached overview and the sidebar header (if this is the
 * selected workspace), and refreshes the workspace lists. A failure shows the
 * global error toast.
 * @param workspaceId - the workspace to rename
 */
const useRenameWorkspace = (workspaceId: number) => {
    const queryClient = useQueryClient();
    const setCurrentWorkspace = useSetAtom(currentWorkspaceAtom);

    const { mutate, isPending } = useMutation({
        mutationFn: async (name: string) => {
            await apiClient.patch(`/workspaces/${workspaceId}`, { name });
        },
        meta: { errorMessage: "Couldn't rename the workspace" },
        onSuccess: (_data, name) => {
            // Set the name straight away rather than refetching, so the
            // Save button hides as soon as the request succeeds.
            queryClient.setQueryData<WorkspaceOverviewResponseDto>(
                workspaceKeys.overview(workspaceId),
                (overview) => overview && { ...overview, name },
            );
            setCurrentWorkspace((current) =>
                current?.id === workspaceId ? { ...current, name } : current,
            );
            queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.searches(),
            });
            showToast("Workspace renamed");
        },
    });

    return {
        renameWorkspace: (name: string) => mutate(name), // sends the rename request
        isRenaming: isPending, // true while the rename request is in flight
    };
};

export default useRenameWorkspace;
