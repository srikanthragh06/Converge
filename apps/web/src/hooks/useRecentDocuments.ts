import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import apiClient from "../lib/http";
import { currentWorkspaceAtom } from "../atoms/sidebar";
import { documentKeys } from "../queries/documents";
import type { GetLibraryDocumentsResponseDto } from "@converge/shared";

const RECENT_DOCUMENTS_LIMIT = 12;

/**
 * The sidebar's Recent section: the most recently visited documents in the
 * current workspace. Leaves out pinned documents (ignorePinnedDocs), since
 * the Pinned section above already shows them.
 */
const useRecentDocuments = () => {
    const currentWorkspace = useAtomValue(currentWorkspaceAtom);
    const workspaceId = currentWorkspace?.id ?? 0;

    const { data } = useQuery({
        queryKey: documentKeys.recent(workspaceId),
        queryFn: async () => {
            const { data } =
                await apiClient.get<GetLibraryDocumentsResponseDto>(
                    "/document/library",
                    {
                        params: {
                            workspaceId,
                            limit: RECENT_DOCUMENTS_LIMIT,
                            ignorePinnedDocs: true,
                        },
                    },
                );
            return data.documents;
        },
        enabled: currentWorkspace !== null,
    });

    return { recentDocuments: data ?? [] };
};

export default useRecentDocuments;
