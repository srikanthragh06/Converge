/**
 * Query keys for document data. A key is the address of a cached piece of
 * data; every key starts with "documents", so invalidating `documentKeys.all`
 * refreshes everything here, and `documentKeys.lists()` just the lists.
 * List keys carry the workspace id, so each workspace has its own cache.
 */
export const documentKeys = {
    /** Every document query. */
    all: ["documents"] as const,
    /** Every list: sidebar recents and pins, Library, Trash, the ⌘K switcher. */
    lists: () => ["documents", "list"] as const,
    /** Sidebar "Recent" (unpinned documents). */
    recent: (workspaceId: number) =>
        ["documents", "list", "recent", workspaceId] as const,
    /** Sidebar "Pinned". */
    pinned: (workspaceId: number) =>
        ["documents", "list", "pinned", workspaceId] as const,
    /** Library page; `search` is the typed title text, "" when not searching. */
    library: (workspaceId: number, search: string) =>
        ["documents", "list", "library", workspaceId, search] as const,
    /** Trash page. */
    trash: (workspaceId: number) =>
        ["documents", "list", "trash", workspaceId] as const,
    /** ⌘K switcher; kept apart from Library because it loads a different page size. */
    switcher: (workspaceId: number, search: string) =>
        ["documents", "list", "switcher", workspaceId, search] as const,
    /** One document's own data: title, access, workspace. */
    detail: (documentId: number) =>
        ["documents", "detail", documentId] as const,
    /** One document's details dialog: owner, dates, size. */
    overview: (documentId: number) =>
        ["documents", "overview", documentId] as const,
};
