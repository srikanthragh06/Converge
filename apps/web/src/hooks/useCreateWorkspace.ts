import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { currentWorkspaceAtom } from "../atoms/sidebar";
import apiClient from "../lib/http";
import { workspaceKeys } from "../queries/workspaces";
import type { CreateWorkspaceResponseDto } from "@converge/shared";

/**
 * Creates a workspace via POST /workspaces, selects it via
 * PUT /workspaces/:id/select (so the choice survives a reload), refreshes the
 * workspace lists, and opens /library in it. A failure shows the global error
 * toast.
 * @param onSuccess - called after a successful create, before navigating
 */
const useCreateWorkspace = ({ onSuccess }: { onSuccess: () => void }) => {
    const queryClient = useQueryClient();
    const setCurrentWorkspace = useSetAtom(currentWorkspaceAtom);
    const navigate = useNavigate();

    const { mutate, isPending } = useMutation({
        mutationFn: async (name: string) => {
            const { data } = await apiClient.post<CreateWorkspaceResponseDto>(
                "/workspaces",
                { name },
            );
            await apiClient.put(`/workspaces/${data.id}/select`);
            return data;
        },
        meta: { errorMessage: "Couldn't create the workspace" },
        onSuccess: (created) => {
            queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
            queryClient.invalidateQueries({
                queryKey: workspaceKeys.searches(),
            });
            setCurrentWorkspace({ id: created.id, name: created.name });
            onSuccess();
            navigate("/library");
        },
    });

    return {
        createWorkspace: (name: string) => mutate(name), // sends the create request
        isCreating: isPending, // true while the create request is in flight
    };
};

export default useCreateWorkspace;
