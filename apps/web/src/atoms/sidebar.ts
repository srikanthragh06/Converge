import { atom } from "jotai";
import type { LibraryDocumentDto, WorkspaceDto } from "@converge/shared";

/** The user's currently selected workspace (id and name). Initialized from the auth response. */
export const currentWorkspaceAtom = atom<{ id: number; name: string } | null>(
    null,
);

/** All workspaces the authenticated user belongs to. Populated on sidebar mount. */
export const workspacesAtom = atom<WorkspaceDto[]>([]);

/** Increment to trigger a sidebar data refresh (recent documents, etc.). */
export const refreshSidebarAtom = atom(0);

/** Recent documents in the current workspace, persisted across sidebar remounts to avoid flicker. */
export const recentDocumentsAtom = atom<LibraryDocumentDto[]>([]);
