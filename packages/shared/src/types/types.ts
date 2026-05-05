import z from "zod";

/** Valid access levels for the document_access table. */
export const DocumentAccessLevelSchema = z.enum([
    "admin",
    "editor",
    "viewer",
    "none",
]);
export type DocumentAccessLevel = z.infer<typeof DocumentAccessLevelSchema>;
