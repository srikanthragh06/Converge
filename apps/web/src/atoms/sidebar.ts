import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { LibraryDocumentDto } from "@converge/shared";

/** The user's currently selected workspace (id and name). Initialized from the auth response. */
export const currentWorkspaceAtom = atom<{ id: number; name: string } | null>(
    null,
);

/** Increment to trigger a sidebar data refresh (pinned and recent documents). */
export const refreshSidebarAtom = atom(0);

/** Recent documents in the current workspace, persisted across sidebar remounts to avoid flicker. Excludes pinned documents — see pinnedDocumentsAtom. */
export const recentDocumentsAtom = atom<LibraryDocumentDto[]>([]);

/** Documents the user has pinned in the current workspace, most-recently-pinned first. Persisted across sidebar remounts to avoid flicker. */
export const pinnedDocumentsAtom = atom<LibraryDocumentDto[]>([]);

/**
 * Pin state set by a pin/unpin in this session, by document id. Takes
 * precedence over an isPinned fetched earlier (e.g. by the editor), so a
 * toggle from the sidebar also flips the open document's ⋯ menu label.
 */
export const pinOverridesAtom = atom<Record<number, boolean>>({});

/** Which collapsible sidebar sections are expanded, remembered across visits. Read on init so the first render doesn't flash the defaults. */
export const sidebarSectionsAtom = atomWithStorage(
    "converge-sidebar-sections",
    { pinned: true, recent: true },
    undefined,
    { getOnInit: true },
);

/** Whether the sidebar is collapsed to its icon rail, remembered across pages and visits. Read on init so the first render doesn't flash the panel. */
export const sidebarCollapsedAtom = atomWithStorage(
    "converge-sidebar-collapsed",
    false,
    undefined,
    { getOnInit: true },
);

/** Whether the sidebar drawer is open on phones, where it overlays the page instead of sitting beside it. */
export const mobileSidebarOpenAtom = atom(false);
