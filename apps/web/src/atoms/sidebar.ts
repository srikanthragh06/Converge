import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/** The user's currently selected workspace (id and name). Initialized from the auth response. */
export const currentWorkspaceAtom = atom<{ id: number; name: string } | null>(
    null,
);

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
