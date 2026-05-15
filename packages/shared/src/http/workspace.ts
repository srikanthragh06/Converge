import { z } from "zod";
import {
    DocumentAccessLevelSchema,
    WorkspaceRoleSchema,
    WorkspaceTypeSchema,
} from "../types/types";

/** A workspace entry in the workspaces listing, enriched with owner info and selection state. */
export const WorkspaceDtoSchema = z.object({
    id: z.number(),
    name: z.string(),
    type: WorkspaceTypeSchema,
    role: WorkspaceRoleSchema,
    ownerId: z.number(),
    ownerName: z.string(),
    isSelected: z.boolean(),
});

export type WorkspaceDto = z.infer<typeof WorkspaceDtoSchema>;

/** Response for GET /workspaces — lists every workspace the user belongs to. */
export const GetWorkspacesResponseSchema = z.object({
    workspaces: z.array(WorkspaceDtoSchema),
});

export type GetWorkspacesResponseDto = z.infer<
    typeof GetWorkspacesResponseSchema
>;

/** Response for PUT /workspaces/:id/select — the newly selected workspace. */
export const SetSelectedWorkspaceResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
});

export type SetSelectedWorkspaceResponseDto = z.infer<
    typeof SetSelectedWorkspaceResponseSchema
>;

/** Request body for POST /workspaces — creates a new custom workspace. */
export const CreateWorkspaceRequestSchema = z.object({
    name: z.string().min(1, "Name is required").max(128),
});

export type CreateWorkspaceRequestDto = z.infer<
    typeof CreateWorkspaceRequestSchema
>;

/** Response for POST /workspaces — the newly created workspace. */
export const CreateWorkspaceResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
    type: WorkspaceTypeSchema,
    role: WorkspaceRoleSchema,
});

export type CreateWorkspaceResponseDto = z.infer<
    typeof CreateWorkspaceResponseSchema
>;

/** Query params for GET /workspaces/search — searches workspaces by name. */
export const SearchWorkspacesRequestSchema = z.object({
    q: z.string().min(1).max(256),
});

export type SearchWorkspacesRequestDto = z.infer<
    typeof SearchWorkspacesRequestSchema
>;

/** Response for GET /workspaces/search — same shape as the list endpoint. */
export const SearchWorkspacesResponseSchema = z.object({
    workspaces: z.array(WorkspaceDtoSchema),
});

export type SearchWorkspacesResponseDto = z.infer<
    typeof SearchWorkspacesResponseSchema
>;

/** Request body for PATCH /workspaces/:id — updates workspace fields. */
export const UpdateWorkspaceRequestSchema = z.object({
    name: z.string().min(1, "Name is required").max(128),
});

export type UpdateWorkspaceRequestDto = z.infer<
    typeof UpdateWorkspaceRequestSchema
>;

/** Response for GET /workspaces/:id/my-role — the caller's role in the workspace. */
export const GetWorkspaceMyRoleResponseSchema = z.object({
    role: WorkspaceRoleSchema,
});

export type GetWorkspaceMyRoleResponseDto = z.infer<
    typeof GetWorkspaceMyRoleResponseSchema
>;

/** Response for GET /workspaces/:id/overview — workspace details with counts and owner info. */
export const WorkspaceOverviewResponseSchema = z.object({
    name: z.string(),
    type: WorkspaceTypeSchema,
    membersCount: z.number(),
    documentsCount: z.number(),
    ownerName: z.string(),
    ownerEmail: z.string(),
    createdAt: z.string(),
});

export type WorkspaceOverviewResponseDto = z.infer<
    typeof WorkspaceOverviewResponseSchema
>;

/** A member of a workspace with their profile and role. */
export const WorkspaceMemberSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
    role: WorkspaceRoleSchema,
});

export type WorkspaceMemberDto = z.infer<typeof WorkspaceMemberSchema>;

/** Response for GET /workspaces/:id/members — paginated member list with keyset cursor. */
export const GetWorkspaceMembersResponseSchema = z.object({
    members: z.array(WorkspaceMemberSchema),
    nextCursor: z.number().nullable(),
});

export type GetWorkspaceMembersResponseDto = z.infer<
    typeof GetWorkspaceMembersResponseSchema
>;

/** Query params for GET /workspaces/:id/members — optional limit and cursorId for keyset pagination. */
export const GetWorkspaceMembersRequestSchema = z.object({
    limit: z.coerce.number().int().positive().optional(),
    cursorId: z.coerce.number().int().positive().optional(),
});

export type GetWorkspaceMembersRequestDto = z.infer<
    typeof GetWorkspaceMembersRequestSchema
>;

/** Query params for GET /workspaces/:id/members/search — searches existing members by email. */
export const SearchWorkspaceMembersRequestSchema = z.object({
    email: z.string().min(1).max(256),
});

export type SearchWorkspaceMembersRequestDto = z.infer<
    typeof SearchWorkspaceMembersRequestSchema
>;

/** Response for GET /workspaces/:id/members/search — matching members. */
export const SearchWorkspaceMembersResponseSchema = z.object({
    members: z.array(WorkspaceMemberSchema),
});

export type SearchWorkspaceMembersResponseDto = z.infer<
    typeof SearchWorkspaceMembersResponseSchema
>;

/** Query params for GET /workspaces/:id/findNewUser — finds a user by exact email who isn't a member yet. */
export const FindNewWorkspaceUserRequestSchema = z.object({
    email: z.string().min(1).max(256),
});

export type FindNewWorkspaceUserRequestDto = z.infer<
    typeof FindNewWorkspaceUserRequestSchema
>;

/** Response for GET /workspaces/:id/findNewUser — the matched user's basic profile. */
export const FindNewWorkspaceUserResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
});

export type FindNewWorkspaceUserResponseDto = z.infer<
    typeof FindNewWorkspaceUserResponseSchema
>;

/** Request body for POST /workspaces/:id/members — adds a member or updates their role. */
export const AddWorkspaceMemberRequestSchema = z.object({
    email: z.string().min(1).max(256),
    role: WorkspaceRoleSchema,
});

export type AddWorkspaceMemberRequestDto = z.infer<
    typeof AddWorkspaceMemberRequestSchema
>;

/** Response for POST /workspaces/:id/members — the added or updated member. */
export const AddWorkspaceMemberResponseSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.email(),
    avatarUrl: z.string().nullable(),
    role: WorkspaceRoleSchema,
});

export type AddWorkspaceMemberResponseDto = z.infer<
    typeof AddWorkspaceMemberResponseSchema
>;

/** Response for GET /workspaces/:id/doc-access-defaults — per-role document access defaults. */
export const GetWorkspaceDocAccessDefaultsResponseSchema = z.object({
    adminDocAccess: DocumentAccessLevelSchema,
    memberDocAccess: DocumentAccessLevelSchema,
    nonMemberDocAccess: DocumentAccessLevelSchema,
});

export type GetWorkspaceDocAccessDefaultsResponseDto = z.infer<
    typeof GetWorkspaceDocAccessDefaultsResponseSchema
>;

/** Request body for PATCH /workspaces/:id/doc-access-defaults — updates one or more per-role defaults. At least one field must be provided. */
export const UpdateWorkspaceDocAccessDefaultsRequestSchema = z
    .object({
        adminDocAccess: DocumentAccessLevelSchema.optional(),
        memberDocAccess: DocumentAccessLevelSchema.optional(),
        nonMemberDocAccess: DocumentAccessLevelSchema.optional(),
    })
    .refine(
        (d) =>
            d.adminDocAccess !== undefined ||
            d.memberDocAccess !== undefined ||
            d.nonMemberDocAccess !== undefined,
        { message: "At least one field must be provided." },
    );

export type UpdateWorkspaceDocAccessDefaultsRequestDto = z.infer<
    typeof UpdateWorkspaceDocAccessDefaultsRequestSchema
>;
