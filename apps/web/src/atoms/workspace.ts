import { atom } from "jotai";

/** The user's currently selected workspace (id and name). Initialized from the auth response. */
export const currentWorkspaceAtom = atom<{ id: number; name: string } | null>(
    null,
);

/** All workspaces the authenticated user belongs to. Populated on sidebar mount. */
export const workspacesAtom = atom<
    { id: number; name: string; type: string; role: string }[]
>([]);

/** Increment to trigger a sidebar data refresh (recent documents, etc.). */
export const refreshSidebarAtom = atom(0);
