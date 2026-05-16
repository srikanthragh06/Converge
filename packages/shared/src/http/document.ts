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
    workspace: z.object({ id: z.number(), name: z.string() }),
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
/** A single user entry in the document access list. Shared by both the access list and search endpoints. */
export const DocumentAccessUserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
    access: DocumentAccessLevelSchema,
    fallbackAccess: DocumentAccessLevelSchema,
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


/** Response for GET /document/:id/access/find-new — a user who exists but has no access yet. */
export const FindNewDocumentAccessUserResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
    fallbackAccess: DocumentAccessLevelSchema,
});

export type FindNewDocumentAccessUserResponseDto = z.infer<
    typeof FindNewDocumentAccessUserResponseSchema
>;



/** Response for GET /document-access/:id/role-overrides — per-role doc-level overrides with workspace defaults for context. */
export const GetDocumentRoleOverridesResponseSchema = z.object({
    adminDocAccess: DocumentAccessLevelSchema.nullable(),
    memberDocAccess: DocumentAccessLevelSchema.nullable(),
    nonMemberDocAccess: DocumentAccessLevelSchema.nullable(),
    workspaceAdminDocAccess: DocumentAccessLevelSchema,
    workspaceMemberDocAccess: DocumentAccessLevelSchema,
    workspaceNonMemberDocAccess: DocumentAccessLevelSchema,
    workspaceName: z.string(),
});

export type GetDocumentRoleOverridesResponseDto = z.infer<
    typeof GetDocumentRoleOverridesResponseSchema
>;

/** Request body for PUT /document-access/:id/role-overrides — null resets a role to the workspace default; at least one field required. */
export const UpdateDocumentRoleOverridesRequestSchema = z
    .object({
        adminDocAccess: DocumentAccessLevelSchema.nullable().optional(),
        memberDocAccess: DocumentAccessLevelSchema.nullable().optional(),
        nonMemberDocAccess: DocumentAccessLevelSchema.nullable().optional(),
    })
    .refine(
        (d) =>
            d.adminDocAccess !== undefined ||
            d.memberDocAccess !== undefined ||
            d.nonMemberDocAccess !== undefined,
        { message: "At least one field must be provided." },
    );

export type UpdateDocumentRoleOverridesRequestDto = z.infer<
    typeof UpdateDocumentRoleOverridesRequestSchema
>;

/** Response for PUT /document-access/:id/role-overrides — the three per-role overrides after update. */
export const UpdateDocumentRoleOverridesResponseSchema = z.object({
    adminDocAccess: DocumentAccessLevelSchema.nullable(),
    memberDocAccess: DocumentAccessLevelSchema.nullable(),
    nonMemberDocAccess: DocumentAccessLevelSchema.nullable(),
});

export type UpdateDocumentRoleOverridesResponseDto = z.infer<
    typeof UpdateDocumentRoleOverridesResponseSchema
>;

/** Query params for GET /document-access/:id — keyset-paginated per-user access list. */
export const GetDocumentAccessUsersRequestSchema = z.object({
    limit: z.coerce.number().int().positive().optional(),
    cursorId: z.coerce.number().int().positive().optional(),
});

export type GetDocumentAccessUsersRequestDto = z.infer<
    typeof GetDocumentAccessUsersRequestSchema
>;

/** Query params for GET /document-access/:id/search — fuzzy email search over existing access entries. */
export const SearchDocumentAccessUsersRequestSchema = z.object({
    email: z.string().min(1),
});

export type SearchDocumentAccessUsersRequestDto = z.infer<
    typeof SearchDocumentAccessUsersRequestSchema
>;

/** Query params for GET /document-access/:id/find-new — exact email lookup for a user with no explicit access yet. */
export const FindNewDocumentAccessUserRequestSchema = z.object({
    email: z.string().email(),
});

export type FindNewDocumentAccessUserRequestDto = z.infer<
    typeof FindNewDocumentAccessUserRequestSchema
>;

/** Request body for PUT /document-access/:id/user/:userId — grants or updates a per-user access level. */
export const SetDocumentUserAccessRequestSchema = z.object({
    access: DocumentAccessLevelSchema,
});

export type SetDocumentUserAccessRequestDto = z.infer<
    typeof SetDocumentUserAccessRequestSchema
>;

/** Response for PUT /document-access/:id/user/:userId — the target user's profile with their new access level. */
export const SetDocumentUserAccessResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
    access: DocumentAccessLevelSchema,
});

export type SetDocumentUserAccessResponseDto = z.infer<
    typeof SetDocumentUserAccessResponseSchema
>;
