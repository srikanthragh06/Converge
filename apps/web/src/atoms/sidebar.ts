import { atom } from "jotai";
import type { LibraryDocumentDto, WorkspaceDto } from "@converge/shared";

/** The user's currently selected workspace (id and name). Initialized from the auth response. */
export const currentWorkspaceAtom = atom<{ id: number; name: string } | null>(
    null,
);

/** All workspaces the authenticated user belongs to. Populated on sidebar mount. */
export const workspacesAtom = atom<WorkspaceDto[]>([]);

/** Increment to trigger a sidebar data refresh (workspaces, pinned documents, recent documents). */
export const refreshSidebarAtom = atom(0);

/** Recent documents in the current workspace, persisted across sidebar remounts to avoid flicker. Excludes pinned documents — see pinnedDocumentsAtom. */
export const recentDocumentsAtom = atom<LibraryDocumentDto[]>([]);

/** Documents the user has pinned in the current workspace, most-recently-pinned first. Persisted across sidebar remounts to avoid flicker. */
export const pinnedDocumentsAtom = atom<LibraryDocumentDto[]>([]);
