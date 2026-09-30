/**
 * Query keys for who can open a document (the Share dialog). Workspace-wide
 * defaults live in `workspaceKeys.docAccessDefaults`.
 */
export const accessKeys = {
    /** Every document-access query. */
    all: ["access"] as const,
    /** People given access to one document (paginated). */
    list: (documentId: number) => ["access", "list", documentId] as const,
    /** One document's per-role access overrides. */
    roleOverrides: (documentId: number) =>
        ["access", "role-overrides", documentId] as const,
    /** "Add person" lookup: is this email a user, and do they already have access? */
    findNewUser: (documentId: number, email: string) =>
        ["access", "find-new-user", documentId, email] as const,
};
