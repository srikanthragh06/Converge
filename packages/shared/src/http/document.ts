import { z } from "zod";

export const CreateDocumentResponseSchema = z.object({
    documentId: z.number(),
});

export type CreateDocumentResponseDto = z.infer<
    typeof CreateDocumentResponseSchema
>;

export const GetDocumentResponseSchema = z.object({
    id: z.number(),
    title: z.string(),
    creatorId: z.number(),
    createdAt: z.coerce.date(),
});

export type GetDocumentResponseDto = z.infer<typeof GetDocumentResponseSchema>;

/**
 * Query params for GET /document/library.
 * limit defaults to 20 if omitted.
 * cursorVisitedAt and cursorId must both be present or both be absent —
 * they together form the compound cursor for keyset pagination.
 */
export const GetLibraryDocumentsRequestSchema = z
    .object({
        limit: z.coerce.number().int().positive().optional(),
        cursorVisitedAt: z.coerce.date().optional(),
        cursorId: z.coerce.number().int().positive().optional(),
    })
    .refine(
        (data) =>
            (data.cursorVisitedAt === undefined) ===
            (data.cursorId === undefined),
        {
            message:
                "cursorVisitedAt and cursorId must both be provided or both be omitted",
        },
    );

export type GetLibraryDocumentsRequestDto = z.infer<
    typeof GetLibraryDocumentsRequestSchema
>;

/** A single document entry returned by the library listing. */
export const LibraryDocumentSchema = z.object({
    id: z.number(),
    title: z.string(),
    ownerName: z.string(),
    lastVisitedAt: z.coerce.date(),
    lastEditedAt: z.coerce.date(),
});

export type LibraryDocumentDto = z.infer<typeof LibraryDocumentSchema>;

/** Response for GET /document/library. nextCursor is null when there are no more pages. */
export const GetLibraryDocumentsResponseSchema = z.object({
    documents: z.array(LibraryDocumentSchema),
    nextCursor: z
        .object({
            lastVisitedAt: z.coerce.date(),
            id: z.number(),
        })
        .nullable(),
});

export type GetLibraryDocumentsResponseDto = z.infer<
    typeof GetLibraryDocumentsResponseSchema
>;

/**
 * Query params for GET /document/library/search.
 * title must be non-empty and at most 256 characters. limit defaults to 20 if omitted.
 */
export const SearchLibraryDocumentsRequestSchema = z.object({
    title: z.string().min(1).max(256),
    limit: z.coerce.number().int().positive().optional(),
});

export type SearchLibraryDocumentsRequestDto = z.infer<
    typeof SearchLibraryDocumentsRequestSchema
>;

/** Response for GET /document/library/search. */
export const SearchLibraryDocumentsResponseSchema = z.object({
    documents: z.array(LibraryDocumentSchema),
});

export type SearchLibraryDocumentsResponseDto = z.infer<
    typeof SearchLibraryDocumentsResponseSchema
>;
