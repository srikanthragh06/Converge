import { z } from "zod";
import type { DocumentBlock } from "../editor/editorSchema.js";
import { ResolvedDocumentAccessLevelSchema } from "../types/types.js";

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
    // lastVisitedAt is an ISO datetime string, not z.coerce.date() — Zod's
    // JSON Schema conversion (which the MCP SDK calls for every registered
    // tool on tools/list) throws on a raw Date type, since JSON Schema has
    // no Date representation. Strings are also what an MCP client actually
    // has to work with over JSON-RPC regardless.
    cursor: z
        .object({
            lastVisitedAt: z.iso.datetime().nullable(),
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
    cursor?: { lastVisitedAt: string | null; id: number };
};

// A separate response shape from the HTTP GetLibraryDocumentsResponseSchema
// (http/document.ts) — same reason as GetDocumentMetadataToolResponseSchema
// above: that schema's date fields use z.coerce.date(), which can't be
// converted to JSON Schema for tools/list.
export const ListDocumentsToolResponseSchema = z.object({
    documents: z.array(
        z.object({
            id: z.number(),
            title: z.string(),
            access: ResolvedDocumentAccessLevelSchema.describe(
                "The caller's resolved access level for this document.",
            ),
            lastVisitedAt: z.iso.datetime().nullable().describe(
                "When the calling user last visited this document. Null if never visited.",
            ),
            lastEditedAt: z.iso.datetime().nullable().describe(
                "When the calling user last edited this document. Null if never edited.",
            ),
        }),
    ),
    nextCursor: z
        .object({
            lastVisitedAt: z.iso.datetime().nullable(),
            id: z.number(),
        })
        .nullable()
        .describe(
            "Pass this back as the cursor input to fetch the next page. Null when there are no more pages.",
        ),
});

export type ListDocumentsToolResponseDto = z.infer<
    typeof ListDocumentsToolResponseSchema
>;

export const GetDocumentMetadataToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to fetch metadata for.",
    ),
};

export type GetDocumentMetadataToolInputDto = {
    documentId: number;
};

// A separate response shape from the HTTP GetDocumentResponseSchema
// (http/document.ts), which uses z.coerce.date() for createdAt so the web
// client can parse it back into a real Date. That type can't be converted
// to JSON Schema (see the cursor comment above), so the MCP-facing version
// represents createdAt as an ISO string instead.
export const GetDocumentMetadataToolResponseSchema = z.object({
    id: z.number(),
    title: z.string(),
    createdAt: z.iso.datetime(),
    workspace: z.object({ id: z.number(), name: z.string() }),
    resolvedAccess: ResolvedDocumentAccessLevelSchema.describe(
        "The caller's resolved access level for this document.",
    ),
});

export type GetDocumentMetadataToolResponseDto = z.infer<
    typeof GetDocumentMetadataToolResponseSchema
>;

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
    blocks: z.array(z.record(z.string(), z.unknown())).describe(
        "The document's blocks in order, top-level only (nested blocks appear under their parent's children). Each block's id uniquely identifies it and stays the same across reads.",
    ),
});

export type GetDocumentBlocksResponseDto = {
    blocks: DocumentBlock[];
};

// A single edit within an updateDocumentBlocks call. "replace" and "insert"
// take a Markdown string rather than raw BlockNote block JSON — an agent
// writing plain Markdown (which it already knows how to do) is far more
// reliable than one constructing BlockNote's nested content/styles JSON by
// hand, and standard Markdown syntax already maps onto most of this app's
// block types (headings, checklists, tables, code blocks, quotes, lists)
// with no per-block-type rules needed — verified empirically against
// tryParseMarkdownToBlocks. "remove" needs no content at all. Markdown
// can't express everything a block supports (custom colors, alignment,
// image/video-specific props) — those are out of scope for this tool.
export const BlockOperationSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("replace").describe(
            "Removes the target block and inserts the Markdown's blocks in its place. Use this to change a block's content.",
        ),
        blockId: z.string().describe("The id of the block to replace."),
        markdown: z.string().describe(
            "Markdown content to replace the block with. May expand into more than one block.",
        ),
    }),
    z.object({
        type: z.literal("insert").describe(
            "Inserts the Markdown's blocks before or after an existing block.",
        ),
        referenceBlockId: z.string().describe(
            "The id of the existing block to insert next to.",
        ),
        placement: z.enum(["before", "after"]).describe(
            "Whether to insert before or after referenceBlockId.",
        ),
        markdown: z.string().describe("Markdown content to insert."),
    }),
    z.object({
        type: z.literal("remove").describe("Deletes the given blocks."),
        blockIds: z.array(z.string()).describe(
            "The ids of the blocks to delete.",
        ),
    }),
]);

export type BlockOperationDto = z.infer<typeof BlockOperationSchema>;

export const UpdateDocumentBlocksToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to edit.",
    ),
    // A single call takes a batch of edits, applied as one atomic save —
    // either all of them apply or none do (e.g. a stale/nonexistent
    // blockId fails the whole batch rather than partially applying edits).
    // Prefer batching related edits into one call over several separate
    // calls: each call is one saved revision and one update pushed to any
    // live viewers, so grouping a multi-block change into one call is both
    // more efficient and more meaningful as a single edit.
    operations: z.array(BlockOperationSchema).min(1).describe(
        "The edits to apply, in order, as a single atomic save.",
    ),
};

export type UpdateDocumentBlocksToolInputDto = {
    documentId: number;
    operations: BlockOperationDto[];
};

// Returns the document's full updated block list rather than just a success
// flag — the caller needs it to see the real ids of any newly inserted
// blocks, which it has no way to predict in advance.
export const UpdateDocumentBlocksResponseSchema = z.object({
    blocks: z.array(z.record(z.string(), z.unknown())).describe(
        "The document's full block list after applying the edits.",
    ),
});

export type UpdateDocumentBlocksResponseDto = {
    blocks: DocumentBlock[];
};
