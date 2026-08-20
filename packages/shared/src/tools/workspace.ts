import { z } from "zod";
import { WorkspaceDtoSchema } from "../http/workspace.js";

// No input needed — lists every workspace the calling user is a member of,
// same as GET /workspaces. Registered as an empty shape rather than omitted
// entirely, since the MCP SDK's registerTool still expects a ZodRawShape
// (even an empty one) for its inputSchema option.
export const ListWorkspacesToolInputSchema = {};

export type ListWorkspacesToolInputDto = Record<string, never>;

// Reuses WorkspaceDtoSchema as-is — unlike most other tools/*.ts response
// schemas, no MCP-specific redefinition is needed here, since the shape has
// no Date fields that would fail the MCP SDK's JSON Schema conversion.
export const ListWorkspacesToolResponseSchema = z.object({
    workspaces: z.array(WorkspaceDtoSchema),
});

export type ListWorkspacesToolResponseDto = z.infer<
    typeof ListWorkspacesToolResponseSchema
>;
