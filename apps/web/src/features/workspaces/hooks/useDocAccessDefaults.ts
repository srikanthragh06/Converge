import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/http";
import { workspaceKeys } from "@/features/workspaces/queryKeys";
import type { GetWorkspaceDocAccessDefaultsResponseDto } from "@converge/shared";

/**
 * A workspace's default document access per role (admins, members,
 * non-members), from GET /workspaces/:id/doc-access-defaults.
 * @param workspaceId - the workspace being configured
 */
const useDocAccessDefaults = (workspaceId: number) => {
    const { data } = useQuery({
        queryKey: workspaceKeys.docAccessDefaults(workspaceId),
        queryFn: async () => {
            const { data } =
                await apiClient.get<GetWorkspaceDocAccessDefaultsResponseDto>(
                    `/workspaces/${workspaceId}/doc-access-defaults`,
                );
            return data;
        },
    });

    return { defaults: data ?? null }; // null until loaded
};

export default useDocAccessDefaults;
