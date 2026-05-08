import z from "zod";

/** Valid access levels for the document_access table. */
export const DocumentAccessLevelSchema = z.enum([
    "admin",
    "editor",
    "viewer",
    "noAccess",
]);
export type DocumentAccessLevel = z.infer<typeof DocumentAccessLevelSchema>;

/** Resolved access level for a user on a document, including the owner tier which is not stored in document_access. */
export type ResolvedDocumentAccessLevel = DocumentAccessLevel | 'owner';
