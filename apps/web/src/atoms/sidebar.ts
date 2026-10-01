import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/** The user's currently selected workspace (id and name). Initialized from the auth response. */
export const currentWorkspaceAtom = atom<{ id: number; name: string } | null>(
    null,
);

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
