import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type ModelMessage } from 'ai';
import type { Response } from 'express';
import { DatabaseService } from '../db/database.service.js';
import { WorkspaceService } from '../workspace/workspace.service.js';
import {
  INTERNAL_SERVER_ERROR_MESSAGE,
  type CreateAgentConversationResponseDto,
  type SendAgentMessageRequestDto,
} from '@converge/shared';

/**
 * Plumbing-phase agent chat: single-turn, zero tools. Persists the
 * conversation/message history and streams Gemini's reply back via the AI
 * SDK's UI message stream protocol, to validate auth/routing/persistence/
 * streaming in isolation before a later phase adds tool-calling on top.
 */
@Injectable()
export class AgentService {
  // gemini-3.1-flash-lite: the default model chosen for this feature (see
  // the AI Agent Feature brainstorm doc). No model picker yet.
  private static readonly MODEL = 'gemini-3.1-flash-lite';

  private readonly google: ReturnType<typeof createGoogleGenerativeAI>; // Vercel AI SDK Google provider, constructed once per instance with the configured API key.

  constructor(
    private readonly dbService: DatabaseService,
    private readonly workspaceService: WorkspaceService,
    private readonly configService: ConfigService,
  ) {
    // Passed explicitly rather than relying on the SDK's implicit
    // process.env.GOOGLE_GENERATIVE_AI_API_KEY read, matching how every
    // other service in this app sources config through ConfigService.
    this.google = createGoogleGenerativeAI({
      apiKey: this.configService.getOrThrow<string>('GEMINI_API_KEY'),
    });
  }

  /**
   * Creates a new conversation under the given workspace, owned by the
   * calling user. Conversation creation is a separate endpoint from message
   * sending so the latter never has to branch on "new vs. continuing."
   *
   * @param userId - The authenticated caller, stamped by AuthGuard.
   * @param workspaceId - The workspace this conversation is scoped to.
   */
  async createConversation(
    userId: number,
    workspaceId: number,
  ): Promise<CreateAgentConversationResponseDto> {
    // Reuses WorkspaceService's own membership check (throws 404/403 as
    // appropriate) rather than duplicating the query — the agent feature has
    // no access rules of its own yet beyond "caller is a workspace member."
    await this.workspaceService.getMyRole(workspaceId, userId);

    const created = await this.dbService.kysely
      .insertInto('agent_conversations')
      .values({ workspace_id: workspaceId, user_id: userId })
      .returning(['id', 'created_at'])
      .executeTakeFirstOrThrow();

    return {
      id: created.id,
      workspaceId,
      createdAt: created.created_at,
    };
  }

  /**
   * Handles a single chat turn on an existing conversation: persists the
   * user's message, streams Gemini's reply onto `res` via the AI SDK's UI
   * message stream protocol, then persists the assistant's reply once the
   * stream completes.
   *
   * @param userId - The authenticated caller, stamped by AuthGuard.
   * @param body - The conversation to post into and the message content.
   * @param res - The raw Express response this handler writes the streamed reply to directly.
   */
  async sendMessage(
    userId: number,
    body: SendAgentMessageRequestDto,
    res: Response,
  ): Promise<void> {
    // Look up the conversation and confirm the caller owns it.
    const db = this.dbService.kysely;
    const conversation = await db
      .selectFrom('agent_conversations')
      .select(['id', 'workspace_id'])
      .where('id', '=', body.conversationId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    // Conversations aren't shared across users, so ownership mismatch is
    // indistinguishable from the conversation not existing at all.
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    // Re-checked on every message, not just at conversation-creation time —
    // a user removed from the workspace after starting a conversation
    // shouldn't be able to keep posting into it. Cheap enough to call fresh
    // per message; see DocumentGateway's access-gated handlers for the same
    // reasoning applied to a longer-lived connection.
    await this.workspaceService.getMyRole(conversation.workspace_id, userId);

    const conversationId = conversation.id;

    // Persist the user's message before generating a reply, so it's part of
    // the history fetched below and durable even if generation fails.
    await db
      .insertInto('agent_messages')
      .values({
        conversation_id: conversationId,
        role: 'user',
        content: body.content,
      })
      .execute();

    // Load the full conversation history (including the message just
    // inserted) to give Gemini the complete context for this turn.
    const history = await db
      .selectFrom('agent_messages')
      .select(['role', 'content'])
      .where('conversation_id', '=', conversationId)
      .orderBy('id', 'asc')
      .execute();

    const messages: ModelMessage[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = streamText({
      model: this.google(AgentService.MODEL),
      messages,
    });

    // Sets the response headers/framing itself (the UI message stream
    // protocol — SSE-shaped `data: {...}` parts, not plain text) and owns
    // `res` directly, same tradeoff as McpController handing raw req/res to
    // the MCP SDK's transport — so GlobalExceptionFilter doesn't cover this
    // handler. onError is the SDK's own hook for a mid-stream failure: it
    // logs the real error server-side and reports back the same generic,
    // non-leaking message used everywhere else, as a structured error part
    // in the stream rather than a hand-rolled in-band marker.
    await result.pipeUIMessageStreamToResponse(res, {
      onError: (err) => {
        console.error('Agent stream failed:', err);
        return INTERNAL_SERVER_ERROR_MESSAGE;
      },
    });

    try {
      const assistantText = await result.text;
      await db
        .insertInto('agent_messages')
        .values({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantText,
        })
        .execute();
    } catch (err) {
      // result.text rejects if generation itself failed — the client
      // already got a reported error via onError above, so there's nothing
      // to persist for a turn that never completed.
      console.error(
        'Failed to persist assistant reply after stream error:',
        err,
      );
    }
  }
}
