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
export type ResolvedDocumentAccessLevel = z.infer<typeof ResolvedDocumentAccessLevelSchema>;

/** Numeric rank for each resolved access level, used for ordered comparisons (e.g. hasAccess). */
export const ACCESS_RANK: Record<ResolvedDocumentAccessLevel, number> = {
    noAccess: 0,
    viewer:   10,
    editor:   20,
    admin:    30,
    owner:    40,
};
