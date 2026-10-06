import { z } from "zod";

/** Max characters allowed in a single chat message — bounds per-request token cost, not a product-driven UX limit. */
export const AGENT_MESSAGE_MAX_LENGTH = 4000;

/** Max characters allowed in a conversation title. */
export const AGENT_CONVERSATION_TITLE_MAX_LENGTH = 100;

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
    // Null for a freshly created conversation, or an existing untitled one —
    // the frontend falls back to formatting createdAt in that case.
    title: z
        .string()
        .min(1)
        .max(AGENT_CONVERSATION_TITLE_MAX_LENGTH)
        .nullable(),
});

export type CreateAgentConversationResponseDto = z.infer<
    typeof CreateAgentConversationResponseSchema
>;

/** Request body for PATCH /agent/conversations/:conversationId — renames a conversation. */
export const RenameAgentConversationRequestSchema = z.object({
    title: z.string().min(1).max(AGENT_CONVERSATION_TITLE_MAX_LENGTH),
});

export type RenameAgentConversationRequestDto = z.infer<
    typeof RenameAgentConversationRequestSchema
>;

/** Query params for GET /agent/conversations — lists the caller's conversations under one workspace. */
export const GetAgentConversationsRequestSchema = z.object({
    workspaceId: z.coerce.number().int().positive(),
});

export type GetAgentConversationsRequestDto = z.infer<
    typeof GetAgentConversationsRequestSchema
>;

/**
 * Response for GET /agent/conversations, newest-used first. Backs both the
 * frontend's conversation list/switcher sidebar and its most-recent-first
 * auto-select-on-load behavior.
 */
export const GetAgentConversationsResponseSchema = z.object({
    conversations: z.array(CreateAgentConversationResponseSchema),
});

export type GetAgentConversationsResponseDto = z.infer<
    typeof GetAgentConversationsResponseSchema
>;

/**
 * Request body for POST /agent/messages. conversationId is always required —
 * conversation creation is its own endpoint (POST /agent/conversations) —
 * so this handler never branches on "new vs. continuing." The response to
 * this endpoint is a hand-rolled SSE stream (`data: {...}` chunks —
 * start-step/text-delta/tool-input-available/tool-output-available/error —
 * see AgentService.sendMessage), not a single JSON value, so there's no
 * corresponding response schema here.
 */
export const SendAgentMessageRequestSchema = z.object({
    conversationId: z.number().int().positive(),
    content: z.string().min(1).max(AGENT_MESSAGE_MAX_LENGTH),
});

export type SendAgentMessageRequestDto = z.infer<
    typeof SendAgentMessageRequestSchema
>;

/**
 * One normalized message in a conversation's history, returned by
 * GET /agent/conversations/:conversationId/messages. Shaped to mirror the
 * live SSE chunk vocabulary (tool-input-available/tool-output-available)
 * rather than exposing the raw OpenAI Responses API item shapes stored in
 * agent_messages.content, so the frontend can render history and a live
 * turn through the same code path.
 */
export const AgentMessageDtoSchema = z.discriminatedUnion("role", [
    z.object({
        role: z.literal("user"),
        content: z.string(),
        createdAt: z.coerce.date(),
    }),
    z.object({
        role: z.literal("assistant"),
        stepIndex: z.number(),
        // Empty when this step was pure tool-calling with no text output.
        text: z.string(),
        toolCalls: z.array(
            z.object({
                toolCallId: z.string(),
                toolName: z.string(),
                input: z.unknown(),
            }),
        ),
        createdAt: z.coerce.date(),
    }),
    z.object({
        role: z.literal("tool"),
        stepIndex: z.number(),
        results: z.array(
            z.object({
                toolCallId: z.string(),
                output: z.unknown(),
            }),
        ),
        createdAt: z.coerce.date(),
    }),
]);

export type AgentMessageDto = z.infer<typeof AgentMessageDtoSchema>;

/** Response for GET /agent/conversations/:conversationId/messages, in insertion order. */
export const GetAgentMessagesResponseSchema = z.object({
    messages: z.array(AgentMessageDtoSchema),
});

export type GetAgentMessagesResponseDto = z.infer<
    typeof GetAgentMessagesResponseSchema
>;
