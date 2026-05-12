import z from "zod";

/** Valid access levels for the document_access table. */
export const DocumentAccessLevelSchema = z.enum([
    "admin",
    "editor",
    "viewer",
    "noAccess",
]);
export type DocumentAccessLevel = z.infer<typeof DocumentAccessLevelSchema>;

/** Zod schema for ResolvedDocumentAccessLevel, including the owner tier. */
export const ResolvedDocumentAccessLevelSchema = z.enum([
    "admin",
    "editor",
    "viewer",
    "noAccess",
    "owner",
]);

/** Resolved access level for a user on a document, including the owner tier which is not stored in document_access. */
export type ResolvedDocumentAccessLevel = z.infer<
    typeof ResolvedDocumentAccessLevelSchema
>;

/** Valid workspace types. Personal workspaces are 1:1 per user; custom workspaces are user-created for teams. */
export const WorkspaceTypeSchema = z.enum(["personal", "custom"]);
export type WorkspaceType = z.infer<typeof WorkspaceTypeSchema>;

/** Valid roles for a user within a workspace. */
export const WorkspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

/** Numeric rank for each resolved access level, used for ordered comparisons (e.g. hasAccess). */
export const ACCESS_RANK: Record<ResolvedDocumentAccessLevel, number> = {
    noAccess: 0,
    viewer: 10,
    editor: 20,
    admin: 30,
    owner: 40,
};

/** Numeric rank for each workspace role, used for ordered comparisons (e.g. minimum role checks). */
export const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
    member: 10,
    admin: 20,
    owner: 30,
};

/** Returns true if the user's workspace role meets or exceeds the required role. */
export const hasWorkspaceRole = (
    userRole: WorkspaceRole,
    required: WorkspaceRole,
): boolean => WORKSPACE_ROLE_RANK[userRole] >= WORKSPACE_ROLE_RANK[required];
