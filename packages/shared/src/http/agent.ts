import { z } from "zod";

/** Max characters allowed in a single chat message — bounds per-request token cost, not a product-driven UX limit. */
export const AGENT_MESSAGE_MAX_LENGTH = 4000;

/** Request body for POST /agent/conversations — starts a new conversation under the given workspace. */
export const CreateAgentConversationRequestSchema = z.object({
    workspaceId: z.number().int().positive(),
});

export type CreateAgentConversationRequestDto = z.infer<
    typeof CreateAgentConversationRequestSchema
>;

/** Response for POST /agent/conversations — the newly created conversation. */
export const CreateAgentConversationResponseSchema = z.object({
    id: z.number(),
    workspaceId: z.number(),
    createdAt: z.coerce.date(),
});

export type CreateAgentConversationResponseDto = z.infer<
    typeof CreateAgentConversationResponseSchema
>;

/**
 * Request body for POST /agent/messages. conversationId is always required —
 * conversation creation is its own endpoint (POST /agent/conversations) —
 * so this handler never branches on "new vs. continuing." The response to
 * this endpoint is the AI SDK's UI message stream protocol (SSE-shaped
 * `data: {...}` parts, including a structured error part on failure), not
 * a single JSON value, so there's no corresponding response schema here.
 */
export const SendAgentMessageRequestSchema = z.object({
    conversationId: z.number().int().positive(),
    content: z.string().min(1).max(AGENT_MESSAGE_MAX_LENGTH),
});

export type SendAgentMessageRequestDto = z.infer<
    typeof SendAgentMessageRequestSchema
>;
