import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import apiClient from "@/lib/http";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import { documentKeys } from "@/features/documents/queryKeys";
import type { GetPinnedDocumentsResponseDto } from "@converge/shared";

/**
 * The user's pinned documents in the current workspace, most recently pinned
 * first, from GET /document/pinned (not paginated). Shown in the sidebar's
 * Pinned section and used for each Library row's pin.
 */
const usePinnedDocuments = () => {
    const currentWorkspace = useAtomValue(currentWorkspaceAtom);
    const workspaceId = currentWorkspace?.id ?? 0;

    const { data } = useQuery({
        queryKey: documentKeys.pinned(workspaceId),
        queryFn: async () => {
            const { data } = await apiClient.get<GetPinnedDocumentsResponseDto>(
                "/document/pinned",
                { params: { workspaceId } },
            );
            return data.documents;
        },
        enabled: currentWorkspace !== null,
    });

    return { pinnedDocuments: data ?? [] };
};

export default usePinnedDocuments;
