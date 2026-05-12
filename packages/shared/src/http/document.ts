import { z } from "zod";
import { DocumentAccessLevelSchema, ResolvedDocumentAccessLevelSchema } from "../types/types";

/** Request body for POST /document — the workspace the document belongs to. */
export const CreateDocumentRequestSchema = z.object({
    workspaceId: z.number(),
});

export type CreateDocumentRequestDto = z.infer<
    typeof CreateDocumentRequestSchema
>;

export const CreateDocumentResponseSchema = z.object({
    documentId: z.number(),
});

export type CreateDocumentResponseDto = z.infer<
    typeof CreateDocumentResponseSchema
>;

export const GetDocumentResponseSchema = z.object({
    id: z.number(),
    title: z.string(),
    createdAt: z.coerce.date(),
    resolvedAccess: ResolvedDocumentAccessLevelSchema,
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
});

export type GetDocumentOverviewResponseDto = z.infer<
    typeof GetDocumentOverviewResponseSchema
>;

/**
 * Query params for GET /document/library.
 * workspaceId is the selected workspace scope.
 * limit defaults to 20 if omitted.
 * cursorVisitedAt and cursorId must both be present or both be absent —
 * they together form the compound cursor for keyset pagination.
 */
export const GetLibraryDocumentsRequestSchema = z
    .object({
        workspaceId: z.coerce.number().int().positive(),
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
    access: ResolvedDocumentAccessLevelSchema,
    lastVisitedAt: z.coerce.date().nullable(),
    lastEditedAt: z.coerce.date().nullable(),
});

export type LibraryDocumentDto = z.infer<typeof LibraryDocumentSchema>;

/** Response for GET /document/library. nextCursor is null when there are no more pages. */
export const GetLibraryDocumentsResponseSchema = z.object({
    documents: z.array(LibraryDocumentSchema),
    nextCursor: z
        .object({
            lastVisitedAt: z.coerce.date().nullable(),
            id: z.number(),
        })
        .nullable(),
});

export type GetLibraryDocumentsResponseDto = z.infer<
    typeof GetLibraryDocumentsResponseSchema
>;

/**
 * Query params for GET /document/library/search.
 * workspaceId is the selected workspace scope.
 * title must be non-empty and at most 256 characters. limit defaults to 20 if omitted.
 */
export const SearchLibraryDocumentsRequestSchema = z.object({
    workspaceId: z.coerce.number().int().positive(),
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

/** Response for GET /document/:id/owner — the document owner's basic profile. */
export const GetDocumentOwnerResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
});

export type GetDocumentOwnerResponseDto = z.infer<
    typeof GetDocumentOwnerResponseSchema
>;

/** Request body for PUT /document/:id/access/:targetUserId — sets or updates a user's access level. */
export const SetDocumentAccessRequestSchema = z.object({
    access: DocumentAccessLevelSchema,
});

export type SetDocumentAccessRequestDto = z.infer<
    typeof SetDocumentAccessRequestSchema
>;

/** Query params for GET /document/:id/access/find-new. */
export const FindNewDocumentAccessUserRequestSchema = z.object({
    email: z.string().min(1).max(256),
});

export type FindNewDocumentAccessUserRequestDto = z.infer<
    typeof FindNewDocumentAccessUserRequestSchema
>;

/** Response for GET /document/:id/access/find-new — a user who exists but has no access yet. */
export const FindNewDocumentAccessUserResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
});

export type FindNewDocumentAccessUserResponseDto = z.infer<
    typeof FindNewDocumentAccessUserResponseSchema
>;

/** Query params for GET /document/:id/owner/find — finds a user by exact email to assign as new owner. */
export const FindNewDocumentOwnerRequestSchema = z.object({
    email: z.string().min(1).max(256),
});

export type FindNewDocumentOwnerRequestDto = z.infer<
    typeof FindNewDocumentOwnerRequestSchema
>;

/** Response for GET /document/:id/owner/find — the matched user's basic profile. */
export const FindNewDocumentOwnerResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
});

export type FindNewDocumentOwnerResponseDto = z.infer<
    typeof FindNewDocumentOwnerResponseSchema
>;

/** Request body for PUT /document/:id/owner — transfers ownership to another user. */
export const TransferDocumentOwnerRequestSchema = z.object({
    newOwnerId: z.number().int().positive(),
});

export type TransferDocumentOwnerRequestDto = z.infer<
    typeof TransferDocumentOwnerRequestSchema
>;

/** Response for PUT /document/:id/owner — the new owner's basic profile. */
export const TransferDocumentOwnerResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
});

export type TransferDocumentOwnerResponseDto = z.infer<
    typeof TransferDocumentOwnerResponseSchema
>;

/** Response for GET /document/:id/access/default — the document's fallback access level. */
export const GetDocumentDefaultAccessResponseSchema = z.object({
    defaultAccess: DocumentAccessLevelSchema,
});

export type GetDocumentDefaultAccessResponseDto = z.infer<
    typeof GetDocumentDefaultAccessResponseSchema
>;

/** Request body for PUT /document/:id/access/default — sets the document's fallback access level. */
export const SetDocumentDefaultAccessRequestSchema = z.object({
    defaultAccess: DocumentAccessLevelSchema,
});

export type SetDocumentDefaultAccessRequestDto = z.infer<
    typeof SetDocumentDefaultAccessRequestSchema
>;

/** Response for PUT /document/:id/access/default — echoes back the updated fallback access level. */
export const SetDocumentDefaultAccessResponseSchema = z.object({
    defaultAccess: DocumentAccessLevelSchema,
});

export type SetDocumentDefaultAccessResponseDto = z.infer<
    typeof SetDocumentDefaultAccessResponseSchema
>;
