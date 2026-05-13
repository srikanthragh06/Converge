import { z } from "zod";
import { WorkspaceRoleSchema, WorkspaceTypeSchema } from "../types/types";

const WorkspaceMemberDtoSchema = z.object({
    id: z.number(),
    name: z.string(),
    type: WorkspaceTypeSchema,
    role: WorkspaceRoleSchema,
});

export type WorkspaceMemberDto = z.infer<typeof WorkspaceMemberDtoSchema>;

/** Response for GET /workspaces — lists every workspace the user belongs to. */
export const GetWorkspacesResponseSchema = z.object({
    workspaces: z.array(WorkspaceMemberDtoSchema),
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
