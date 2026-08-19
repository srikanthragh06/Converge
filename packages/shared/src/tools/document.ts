import { z } from "zod";

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

export const GetDocumentMetadataToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to fetch metadata for.",
    ),
};

export type GetDocumentMetadataToolInputDto = {
    documentId: number;
};

export const ReadDocumentMarkdownToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to read as Markdown.",
    ),
};

export type ReadDocumentMarkdownToolInputDto = {
    documentId: number;
};

// Lossy by nature — block ids, custom props, and any structure Markdown can't
// express are dropped in the Blocks -> Markdown conversion. Read-only view;
// writes go through a separate id-addressed block-operations path rather
// than trying to diff edited Markdown back into precise block changes.
export const ReadDocumentMarkdownResponseSchema = z.object({
    markdown: z.string(),
});

export type ReadDocumentMarkdownResponseDto = {
    markdown: string;
};
