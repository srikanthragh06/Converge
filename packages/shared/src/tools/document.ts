import { z } from "zod";
import type { DocumentBlock } from "../editor/editorSchema.js";

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

export const GetDocumentBlocksToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to fetch blocks from.",
    ),
};

export type GetDocumentBlocksToolInputDto = {
    documentId: number;
};

// Blocks are returned as-is rather than validated against a matching Zod
// schema — BlockNote's block union is large and changes with the editor
// schema, and duplicating it here would just be a second copy to keep in
// sync. This is server-generated output, not user input, so looseness here
// isn't the same kind of risk it would be on the write path's input.
export const GetDocumentBlocksResponseSchema = z.object({
    blocks: z.array(z.record(z.string(), z.unknown())),
});

export type GetDocumentBlocksResponseDto = {
    blocks: DocumentBlock[];
};
