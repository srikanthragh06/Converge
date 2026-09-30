/**
 * Query keys for workspace data. Every key starts with "workspaces", so
 * invalidating `workspaceKeys.all` refreshes all of it.
 */
export const workspaceKeys = {
    /** Every workspace query. */
    all: ["workspaces"] as const,
    /** The user's workspaces (with which one is selected). */
    list: () => ["workspaces", "list"] as const,
    /** Workspace search on the Workspaces page; `search` is the typed text. */
    search: (search: string) => ["workspaces", "search", search] as const,
    /** One workspace's settings overview. */
    overview: (workspaceId: number) =>
        ["workspaces", "overview", workspaceId] as const,
    /** The current user's role in one workspace. */
    myRole: (workspaceId: number) =>
        ["workspaces", "my-role", workspaceId] as const,
    /** One workspace's member list (paginated). */
    members: (workspaceId: number) =>
        ["workspaces", "members", workspaceId] as const,
    /** Member search by email within one workspace. */
    memberSearch: (workspaceId: number, email: string) =>
        ["workspaces", "member-search", workspaceId, email] as const,
    /** "Add member" lookup: is this email a user, and already a member? */
    findNewMember: (workspaceId: number, email: string) =>
        ["workspaces", "find-new-member", workspaceId, email] as const,
    /** One workspace's current owner. */
    owner: (workspaceId: number) =>
        ["workspaces", "owner", workspaceId] as const,
    /** "Transfer ownership" lookup: can this email take over? */
    ownerCandidate: (workspaceId: number, email: string) =>
        ["workspaces", "owner-candidate", workspaceId, email] as const,
    /** A workspace's default document access per role. */
    docAccessDefaults: (workspaceId: number) =>
        ["workspaces", "doc-access-defaults", workspaceId] as const,
};
