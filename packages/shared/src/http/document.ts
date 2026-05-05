import { z } from "zod";
import { DocumentAccessLevelSchema } from "../types/types";

export const CreateDocumentResponseSchema = z.object({
    documentId: z.number(),
});

export type CreateDocumentResponseDto = z.infer<
    typeof CreateDocumentResponseSchema
>;

export const GetDocumentResponseSchema = z.object({
    id: z.number(),
    title: z.string(),
    ownerId: z.number(),
    createdAt: z.coerce.date(),
});

export type GetDocumentResponseDto = z.infer<typeof GetDocumentResponseSchema>;

/** Response for GET /document/:id/overview — document metadata shown in the Manage Document modal. */
export const GetDocumentOverviewResponseSchema = z.object({
    title: z.string(),
    creatorName: z.string(),
    creatorEmail: z.string(),
    ownerName: z.string(),
    ownerEmail: z.string(),
    createdAt: z.coerce.date(),
    lastVisitedAt: z.coerce.date(),
    lastEditedAt: z.coerce.date(),
});

export type GetDocumentOverviewResponseDto = z.infer<
    typeof GetDocumentOverviewResponseSchema
>;

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

/** Query params for GET /document/:id/access/search. email must be non-empty and at most 256 characters. */
export const SearchDocumentAccessUsersRequestSchema = z.object({
    email: z.string().min(1).max(256),
    limit: z.coerce.number().int().positive().optional(),
});

export type SearchDocumentAccessUsersRequestDto = z.infer<
    typeof SearchDocumentAccessUsersRequestSchema
>;

/** Query params for GET /document/:id/access. cursorId is the user_id of the last item from the previous page. */
export const GetDocumentAccessRequestSchema = z.object({
    limit: z.coerce.number().int().positive().optional(),
    cursorId: z.coerce.number().int().positive().optional(),
});

export type GetDocumentAccessRequestDto = z.infer<
    typeof GetDocumentAccessRequestSchema
>;

/** A single user entry in the document access list. Shared by both the access list and search endpoints. */
export const DocumentAccessUserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
    access: DocumentAccessLevelSchema,
});

export type DocumentAccessUserDto = z.infer<typeof DocumentAccessUserSchema>;

/** Response for GET /document/:id/access/search — users with access to a document matching the email query. */
export const SearchDocumentAccessUsersResponseSchema = z.object({
    users: z.array(DocumentAccessUserSchema),
});

export type SearchDocumentAccessUsersResponseDto = z.infer<
    typeof SearchDocumentAccessUsersResponseSchema
>;

/** Response for GET /document/:id/access. nextCursor is null when there are no more pages. */
export const GetDocumentAccessResponseSchema = z.object({
    users: z.array(DocumentAccessUserSchema),
    nextCursor: z.number().nullable(),
});

export type GetDocumentAccessResponseDto = z.infer<
    typeof GetDocumentAccessResponseSchema
>;
