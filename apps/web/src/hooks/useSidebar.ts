import { useAtomValue } from "jotai";
import {
    currentWorkspaceAtom,
    pinnedDocumentsAtom,
    recentDocumentsAtom,
} from "../atoms/sidebar";
import useNewDocument from "./useNewDocument";
import useSelectWorkspace from "./useSelectWorkspace";
import useWorkspaceList from "./useWorkspaceList";

/**
 * Sidebar state and actions: the workspace list, selected workspace, pinned +
 * recent documents for the current workspace (the documents kept fresh by
 * useSidebarSync), plus selectWorkspace and document creation. Pin toggling
 * lives in useDocumentMenuActions, shared with the editor's ⋯ menu.
 */
const useSidebar = () => {
    const { createDocument, isCreating } = useNewDocument(); // creates a new document in the current workspace
    const { workspaces, refetch: refetchWorkspaces } = useWorkspaceList(); // all workspaces the user belongs to
    const { selectWorkspace } = useSelectWorkspace(); // switches the selected workspace
    const currentWorkspace = useAtomValue(currentWorkspaceAtom); // currently selected workspace
    const recentDocuments = useAtomValue(recentDocumentsAtom); // most recent, non-pinned documents in the current workspace, shown below the pinned section
    const pinnedDocuments = useAtomValue(pinnedDocumentsAtom); // documents the user has pinned in the current workspace, shown above recentDocuments

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
