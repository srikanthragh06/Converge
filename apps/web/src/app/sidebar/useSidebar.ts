import { useAtomValue } from "jotai";
import { currentWorkspaceAtom } from "@/atoms/sidebar";
import useNewDocument from "@/features/documents/hooks/useNewDocument";
import usePinnedDocuments from "@/features/documents/hooks/usePinnedDocuments";
import useRecentDocuments from "@/features/documents/hooks/useRecentDocuments";
import useSelectWorkspace from "@/features/workspaces/hooks/useSelectWorkspace";
import useWorkspaceList from "@/features/workspaces/hooks/useWorkspaceList";

/**
 * Sidebar state and actions: the workspace list, selected workspace, pinned +
 * recent documents for the current workspace, plus selectWorkspace and
 * document creation. Pin toggling lives in useDocumentMenuActions, shared
 * with the editor's ⋯ menu.
 */
const useSidebar = () => {
    const { createDocument, isCreating } = useNewDocument(); // creates a new document in the current workspace
    const { workspaces, refetch: refetchWorkspaces } = useWorkspaceList(); // all workspaces the user belongs to
    const { selectWorkspace } = useSelectWorkspace(); // switches the selected workspace
    const currentWorkspace = useAtomValue(currentWorkspaceAtom); // currently selected workspace
    const { recentDocuments } = useRecentDocuments(); // shown below the pinned section
    const { pinnedDocuments } = usePinnedDocuments(); // shown above recentDocuments

    return {
        workspaces,
        currentWorkspace,
        recentDocuments,
        pinnedDocuments,
        isCreating,
        selectWorkspace,
        createDocument,
        refetchWorkspaces,
    };
};

export default useSidebar;
