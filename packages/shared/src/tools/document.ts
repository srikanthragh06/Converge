import { z } from "zod";
import { ResolvedDocumentAccessLevelSchema } from "../types/types";

// Tool-facing input schemas are kept as a plain shape (not a wrapped
// z.object) since the MCP SDK's registerTool expects individual per-field
// validators it can assemble itself, rather than a whole-object schema.
export const ListDocumentsToolInputSchema = {
    workspaceId: z.coerce.number().int().positive().describe(
        "The workspace to list documents from.",
    ),
    limit: z.coerce.number().int().positive().optional().describe(
        "Max documents to return in this page. Defaults to 20.",
    ),
    // A single object, not two flat fields — unlike the HTTP /document/library
    // route, which flattens it for URL query params, JSON-RPC has no such
    // constraint. Matches the shape of the response's own nextCursor exactly,
    // so a client can pass a previous page's nextCursor straight back in.
    cursor: z
        .object({
            lastVisitedAt: z.coerce.date().nullable(),
            id: z.number().int().positive(),
        })
        .optional()
        .describe(
            "Pagination cursor from a previous page's nextCursor. Omit for the first page.",
        ),
};

export type ListDocumentsToolInputDto = {
    workspaceId: number;
    limit?: number;
    cursor?: { lastVisitedAt: Date | null; id: number };
};

export const GetDocumentToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to fetch.",
    ),
};

export type GetDocumentToolInputDto = {
    documentId: number;
};

/**
 * updateBase64 is the document's full current state as one self-contained,
 * compacted Yjs update — reconstructed from every persisted update row
 * (checkpoints and raw edits alike merged together), not just the latest
 * checkpoint row, since no single stored row is a full snapshot on its own.
 */
export const GetDocumentToolOutputSchema = z.object({
    id: z.number(),
    title: z.string(),
    createdAt: z.coerce.date(),
    workspace: z.object({ id: z.number(), name: z.string() }),
    resolvedAccess: ResolvedDocumentAccessLevelSchema,
    updateBase64: z.string(),
});

export type GetDocumentToolOutputDto = z.infer<typeof GetDocumentToolOutputSchema>;
