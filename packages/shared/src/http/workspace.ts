import { z } from "zod";
import { WorkspaceRoleSchema, WorkspaceTypeSchema } from "../types/types";

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
