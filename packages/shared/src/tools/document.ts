import { z } from "zod";
import type { DocumentBlock } from "../editor/editorSchema.js";
import {
    ResolvedDocumentAccessLevelSchema,
    CheckpointSourceSchema,
    DocumentIndexingStatusSchema,
} from "../types/types.js";
import { CheckpointContributorSchema } from "../http/document.js";

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

// Shared by both ListDocumentsToolResponseSchema and
// SearchDocumentsToolResponseSchema below — same document summary shape
// either way, just a different set of matching documents.
const DocumentSummaryToolSchema = z.object({
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
});

// A separate response shape from the HTTP GetLibraryDocumentsResponseSchema
// (http/document.ts) — same reason as GetDocumentMetadataToolResponseSchema
// above: that schema's date fields use z.coerce.date(), which can't be
// converted to JSON Schema for tools/list.
export const ListDocumentsToolResponseSchema = z.object({
    documents: z.array(DocumentSummaryToolSchema),
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

export const SearchDocumentsToolInputSchema = {
    workspaceId: z.coerce.number().int().positive().describe(
        "The workspace to search documents in.",
    ),
    title: z.string().min(1).max(256).describe(
        "The search query, matched against document titles by similarity. Must be non-empty.",
    ),
    limit: z.coerce.number().int().positive().optional().describe(
        "Max documents to return. Defaults to 20.",
    ),
};

export type SearchDocumentsToolInputDto = {
    workspaceId: number;
    title: string;
    limit?: number;
};

// No pagination — unlike listDocuments, search results are already ranked
// by relevance, so a single best-effort page (capped by limit) covers the
// "find the doc about X" use case this tool exists for.
export const SearchDocumentsToolResponseSchema = z.object({
    documents: z.array(DocumentSummaryToolSchema).describe(
        "Matching documents ordered by title similarity score descending.",
    ),
});

export type SearchDocumentsToolResponseDto = z.infer<
    typeof SearchDocumentsToolResponseSchema
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

export const CreateDocumentToolInputSchema = {
    workspaceId: z.coerce.number().int().positive().describe(
        "The workspace to create the document in. The caller must be at least a member of this workspace.",
    ),
    // Same rule as the live rename path (SyncDocTitleServerSchema in
    // socket/socket.ts) — kept in sync so a title is valid regardless of
    // which path set it.
    title: z.string().trim().max(256).optional().describe(
        "Optional initial title for the document. Defaults to empty (untitled) if omitted.",
    ),
};

export type CreateDocumentToolInputDto = {
    workspaceId: number;
    title?: string;
};

// No response schema of its own — CreateDocumentResponseSchema
// (http/document.ts) is just { documentId: number }, no date fields, so
// there's no JSON-Schema-conversion issue to work around here (unlike the
// list/metadata tools) and nothing to gain by duplicating it.

export const UpdateDocumentTitleToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to rename.",
    ),
    // Same rule as the live rename path (SyncDocTitleServerSchema in
    // socket/socket.ts) and createDocument's optional title above — kept in
    // sync so a title is valid regardless of which path set it.
    title: z.string().trim().max(256).describe(
        "The document's new title.",
    ),
};

export type UpdateDocumentTitleToolInputDto = {
    documentId: number;
    title: string;
};

export const UpdateDocumentTitleResponseSchema = z.object({
    title: z.string().describe("The document's title after the update."),
});

export type UpdateDocumentTitleResponseDto = z.infer<
    typeof UpdateDocumentTitleResponseSchema
>;

export const DeleteDocumentToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to delete. The caller must have admin access.",
    ),
};

export type DeleteDocumentToolInputDto = {
    documentId: number;
};

// deleteDocument soft-deletes (sets is_deleted/deleted_at) rather than
// removing the row, matching DELETE /document/:id — but the MCP tool has
// nothing meaningful to return either way, so this is just a confirmation
// flag rather than exposing that implementation detail.
export const DeleteDocumentResponseSchema = z.object({
    success: z.literal(true),
});

export type DeleteDocumentResponseDto = z.infer<
    typeof DeleteDocumentResponseSchema
>;

export const ListCheckpointsToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to list version-history checkpoints for.",
    ),
    limit: z.coerce.number().int().positive().optional().describe(
        "Max checkpoints to return in this page. Defaults to 20.",
    ),
    cursorId: z.coerce.number().int().positive().optional().describe(
        "Pagination cursor from a previous page's nextCursor. Omit for the first page.",
    ),
};

export type ListCheckpointsToolInputDto = {
    documentId: number;
    limit?: number;
    cursorId?: number;
};

// A separate response shape from the HTTP GetDocumentCheckpointsResponseSchema
// (http/document.ts) — same reason as ListDocumentsToolResponseSchema above:
// that schema's date fields use z.coerce.date(), which can't be converted to
// JSON Schema for tools/list. CheckpointContributorSchema and
// CheckpointSourceSchema are reused as-is, since neither has a Date field.
export const ListCheckpointsToolResponseSchema = z.object({
    checkpoints: z.array(
        z.object({
            id: z.number(),
            createdAt: z.iso.datetime().describe(
                "When the checkpoint row itself was created.",
            ),
            lastEditedAt: z.iso.datetime().describe(
                "When the most recent edit folded into this checkpoint happened — prefer this over createdAt for display, since automatic checkpoints fire some delay after the last edit.",
            ),
            contributors: z.array(CheckpointContributorSchema).describe(
                "Users who edited the document since the previous checkpoint.",
            ),
            source: CheckpointSourceSchema.describe(
                "What triggered this checkpoint: a manual save, an idle-timeout or interval-based auto-checkpoint, or an automatic checkpoint taken immediately before an MCP-driven edit.",
            ),
        }),
    ),
    nextCursor: z.number().nullable().describe(
        "Pass this back as cursorId to fetch the next page. Null when there are no more pages.",
    ),
});

export type ListCheckpointsToolResponseDto = z.infer<
    typeof ListCheckpointsToolResponseSchema
>;

export const GetCheckpointContentToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document the checkpoint belongs to.",
    ),
    checkpointId: z.coerce.number().int().positive().describe(
        "The checkpoint to read, from a listCheckpoints entry's id.",
    ),
};

export type GetCheckpointContentToolInputDto = {
    documentId: number;
    checkpointId: number;
};

// Same metadata fields as a listCheckpoints entry, plus the checkpoint's
// content — but as BlockNote block JSON (blocks), not the raw
// base64-encoded Yjs update the HTTP endpoint returns. An agent has no use
// for a raw Yjs blob; decoding it into blocks server-side (see
// DocumentTools.getCheckpointContent) matches what getDocumentBlocks already
// returns for a document's live content, so the two are directly comparable.
export const GetCheckpointContentToolResponseSchema = z.object({
    id: z.number(),
    createdAt: z.iso.datetime().describe(
        "When the checkpoint row itself was created.",
    ),
    lastEditedAt: z.iso.datetime().describe(
        "When the most recent edit folded into this checkpoint happened — prefer this over createdAt for display, since automatic checkpoints fire some delay after the last edit.",
    ),
    contributors: z.array(CheckpointContributorSchema).describe(
        "Users who edited the document since the previous checkpoint.",
    ),
    source: CheckpointSourceSchema.describe(
        "What triggered this checkpoint: a manual save, an idle-timeout or interval-based auto-checkpoint, or an automatic checkpoint taken immediately before an MCP-driven edit.",
    ),
    blocks: z.array(z.record(z.string(), z.unknown())).describe(
        "The document's full content at this checkpoint, as BlockNote blocks — same shape as getDocumentBlocks returns for the live document.",
    ),
});

export type GetCheckpointContentToolResponseDto = {
    id: number;
    createdAt: string;
    lastEditedAt: string;
    contributors: z.infer<typeof CheckpointContributorSchema>[];
    source: z.infer<typeof CheckpointSourceSchema>;
    blocks: DocumentBlock[];
};

export const RestoreCheckpointToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to restore.",
    ),
    checkpointId: z.coerce.number().int().positive().describe(
        "The checkpoint to restore the document's content to, from a listCheckpoints entry's id. Requires editor access or higher.",
    ),
};

export type RestoreCheckpointToolInputDto = {
    documentId: number;
    checkpointId: number;
};

// Only blocks are restored, not title — a checkpoint's Yjs update never
// captured title, since title sync is a separate channel. A fresh 'mcp'
// checkpoint is taken immediately before the restore lands (same safety net
// updateDocumentBlocks gets), so an unwanted restore is itself just one more
// restore away from undo.
export const RestoreCheckpointResponseSchema = z.object({
    blocks: z.array(z.record(z.string(), z.unknown())).describe(
        "The document's full block list after the restore.",
    ),
});

export type RestoreCheckpointResponseDto = {
    blocks: DocumentBlock[];
};

export const ListDeletedDocumentsToolInputSchema = {
    workspaceId: z.coerce.number().int().positive().describe(
        "The workspace to list soft-deleted documents from. The caller must have admin access or higher in the workspace, or on the individual document, to see it here.",
    ),
    limit: z.coerce.number().int().positive().optional().describe(
        "Max documents to return in this page. Defaults to 20.",
    ),
    // Same reasoning as ListDocumentsToolInputSchema's cursor: a single
    // object matching nextCursor's shape exactly, rather than the two flat
    // query params the HTTP route uses.
    cursor: z
        .object({
            deletedAt: z.iso.datetime(),
            id: z.number().int().positive(),
        })
        .optional()
        .describe(
            "Pagination cursor from a previous page's nextCursor. Omit for the first page.",
        ),
};

export type ListDeletedDocumentsToolInputDto = {
    workspaceId: number;
    limit?: number;
    cursor?: { deletedAt: string; id: number };
};

// A separate response shape from the HTTP GetTrashDocumentsResponseSchema
// (http/document.ts) — same reason as ListDocumentsToolResponseSchema above:
// that schema's date fields use z.coerce.date(), which can't be converted to
// JSON Schema for tools/list.
export const ListDeletedDocumentsToolResponseSchema = z.object({
    documents: z.array(
        z.object({
            id: z.number(),
            title: z.string(),
            deletedAt: z.iso.datetime().describe(
                "When the document was deleted.",
            ),
        }),
    ),
    nextCursor: z
        .object({
            deletedAt: z.iso.datetime(),
            id: z.number(),
        })
        .nullable()
        .describe(
            "Pass this back as the cursor input to fetch the next page. Null when there are no more pages.",
        ),
});

export type ListDeletedDocumentsToolResponseDto = z.infer<
    typeof ListDeletedDocumentsToolResponseSchema
>;

export const RestoreDocumentToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The soft-deleted document to restore. The caller must have admin access.",
    ),
};

export type RestoreDocumentToolInputDto = {
    documentId: number;
};

// restoreDocument (the underlying service call) returns void — matching
// DeleteDocumentResponseSchema's shape, since there's nothing meaningful to
// return either way beyond confirming success.
export const RestoreDocumentResponseSchema = z.object({
    success: z.literal(true),
});

export type RestoreDocumentResponseDto = z.infer<
    typeof RestoreDocumentResponseSchema
>;

export const SearchDocumentContentToolInputSchema = {
    workspaceId: z.coerce.number().int().positive().describe(
        "The workspace to search within.",
    ),
    question: z.string().min(1).describe(
        "A natural-language question to search for. Content is retrieved and returned as grounded, cited chunks — this tool does not synthesize an answer itself.",
    ),
    limit: z.coerce.number().int().positive().max(20).optional().describe(
        "Max chunks to return. Defaults to 5.",
    ),
};

export type SearchDocumentContentToolInputDto = {
    workspaceId: number;
    question: string;
    limit?: number;
};

// A citation is deliberately minimal — workspaceId + documentId + the
// specific blockIds a chunk spans, no excerpt text or score baked in (those
// travel alongside it in the result, not inside the citation itself). See
// the RAG Discussion doc's "Citations" section.
const RetrievalCitationSchema = z.object({
    workspaceId: z.number(),
    documentId: z.number(),
    blockIds: z.array(z.string()).describe(
        "BlockNote block ids this chunk spans, in document order — use getDocumentBlocks or readDocumentMarkdown to jump to the exact source content.",
    ),
});

export const SearchDocumentContentToolResponseSchema = z.object({
    results: z.array(
        z.object({
            citation: RetrievalCitationSchema,
            content: z.string().describe(
                "The retrieved chunk's text, as Markdown.",
            ),
            score: z.number().describe(
                "Relevance score from reranking — higher is more relevant. Not comparable across separate calls to this tool.",
            ),
        }),
    ),
});

export type SearchDocumentContentToolResponseDto = z.infer<
    typeof SearchDocumentContentToolResponseSchema
>;

export const GetDocumentIndexingStatusToolInputSchema = {
    documentId: z.coerce.number().int().positive().describe(
        "The document to check RAG indexing status for. Requires viewer access or higher.",
    ),
};

export type GetDocumentIndexingStatusToolInputDto = {
    documentId: number;
};

// lastIndexedAt is deliberately "last time a reindex run confirmed the index
// is current" rather than "last time indexed content actually changed" — a
// run that finds nothing to change still updates it, so a long-idle,
// already-up-to-date document reads as fresh rather than looking stale/broken.
// It only advances on a successful run, so a crashed job correctly stops
// advancing it rather than reporting a falsely-fresh time.
export const GetDocumentIndexingStatusToolResponseSchema = z.object({
    indexingStatus: DocumentIndexingStatusSchema.describe(
        "idle: up to date; no reindex is scheduled or running. pending: an edit landed and the reindex job is scheduled to run shortly. indexing: the reindex job is running right now.",
    ),
    lastIndexedAt: z.iso.datetime().nullable().describe(
        "When this document's content was last confirmed indexed. Null if it has never been indexed yet.",
    ),
});

export type GetDocumentIndexingStatusToolResponseDto = z.infer<
    typeof GetDocumentIndexingStatusToolResponseSchema
>;
