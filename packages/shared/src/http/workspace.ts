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
