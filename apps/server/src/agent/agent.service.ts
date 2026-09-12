import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  streamText,
  toUIMessageStream,
  UI_MESSAGE_STREAM_HEADERS,
  type ModelMessage,
  type ToolCallPart,
  type ToolResultPart,
} from 'ai';
import type { Response } from 'express';
import { DatabaseService } from '../db/database.service.js';
import { WorkspaceService } from '../workspace/workspace.service.js';
import { AgentTools } from './agent.tools.js';
import type {
  AgentToolCallRecord,
  AgentToolResultRecord,
} from '../db/database.schema.js';
import {
  INTERNAL_SERVER_ERROR_MESSAGE,
  type CreateAgentConversationResponseDto,
  type SendAgentMessageRequestDto,
} from '@converge/shared';

// Minimal shape both a live SDK tool call/result (from streamText's result)
// and a rehydrated DB row satisfy — lets toStepMessages and
// persistAssistantStep serve both call sites without depending on the
// AI SDK's more specific TypedToolCall/TypedToolResult generics.
type ToolCallLike = { toolCallId: string; toolName: string; input: unknown };
type ToolResultLike = { toolCallId: string; toolName: string; output: unknown };

/**
 * Tool-calling agent chat with a real multi-step loop: each turn runs a
 * plain for-loop over streamText calls (each one still capped at the SDK's
 * own default of one step), continuing only while the model's finishReason
 * says it ended specifically to call a tool. Persists every step of a turn
 * as its own agent_messages row. Streaming is hand-written directly onto
 * `res` (SSE framing, UIMessageChunk shaping via toUIMessageStream) rather
 * than going through createUIMessageStream/writer.merge — that construct is
 * built for merging multiple *concurrent* streams, but our steps run
 * strictly sequentially, one fully finishing before the next starts, so it
 * bought us nothing but its own error-handling/cleanup, which this class
 * now does explicitly instead (see the try/catch/finally in sendMessage).
 */
@Injectable()
export class AgentService {
  // gemini-3.1-flash-lite: the default model chosen for this feature (see
  // the AI Agent Feature brainstorm doc). No model picker yet.
  private static readonly MODEL = 'gemini-3.1-flash-lite';

  // Hard safety bound on steps per turn, independent of the model's own
  // behavior — a later phase's budget/iteration guardrails formalize this
  // further (configurable, cost-aware), but a recursive loop needs *some*
  // bound from the moment it exists, not just once that phase lands.
  private static readonly MAX_STEPS = 8;

  private readonly google: ReturnType<typeof createGoogleGenerativeAI>; // Vercel AI SDK Google provider, constructed once per instance with the configured API key.

  constructor(
    private readonly dbService: DatabaseService,
    private readonly workspaceService: WorkspaceService,
    private readonly agentTools: AgentTools,
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
   * user's message, then loops over streamText calls (one per step) until
   * the model stops calling tools or MAX_STEPS is reached, hand-writing
   * each step's output onto `res` as SSE so the whole turn arrives as one
   * continuous HTTP response.
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
    // inserted), expanding any past turn's tool calls/results back into
    // real assistant/tool ModelMessage pairs — a past tool result is now
    // visible to the model on a later turn, closing the gap phase 2 left
    // open.
    const history = await db
      .selectFrom('agent_messages')
      .select(['role', 'content', 'tool_calls', 'tool_results'])
      .where('conversation_id', '=', conversationId)
      .orderBy('id', 'asc')
      .execute();

    const messages: ModelMessage[] = history.flatMap((m) =>
      m.role === 'user'
        ? [{ role: 'user' as const, content: m.content }]
        : this.toStepMessages(
            m.content,
            m.tool_calls ?? [],
            m.tool_results ?? [],
          ),
    );

    // Scoped to this conversation's fixed workspace — see AgentTools.build
    // for why workspace-scoped tools bind workspaceId server-side rather
    // than taking it as a model-supplied argument.
    const tools = this.agentTools.build(userId, conversation.workspace_id);

    // Hand-written SSE, matching the same headers/framing the SDK's own
    // pipeUIMessageStreamToResponse would have set (UI_MESSAGE_STREAM_HEADERS
    // is the SDK's own exported constant for this, kept for compatibility
    // with whatever eventually reads this stream client-side).
    res.writeHead(200, UI_MESSAGE_STREAM_HEADERS);

    // No backpressure handling on res.write() here (the SDK's own
    // writeToServerResponse awaits the 'drain' event when the internal
    // buffer is full) — acceptable for now at this feature's traffic; would
    // need adding if a single turn's output volume ever became a concern.
    try {
      let currentMessages = messages;

      for (let step = 0; step < AgentService.MAX_STEPS; step++) {
        const result = streamText({
          model: this.google(AgentService.MODEL),
          messages: currentMessages,
          tools,
        });

        // Reshape this step's raw provider events into the browser-facing
        // chunk format as they arrive, and write each one straight onto the
        // open connection — this is what makes the reply appear token by
        // token client-side instead of all at once at the end of the turn.
        for await (const chunk of toUIMessageStream({
          stream: result.stream,
          tools,
        })) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        // All five already resolved by this point — the loop above fully
        // drained the stream, and these promises just hand back values
        // buffered during that drain.
        const [text, toolCalls, toolResults, finishReason, response] =
          await Promise.all([
            result.text,
            result.toolCalls,
            result.toolResults,
            result.finishReason,
            result.response,
          ]);

        await this.persistAssistantStep(
          conversationId,
          step,
          text,
          toolCalls,
          toolResults,
        );

        // Any reason other than 'tool-calls' ends the turn here: 'stop' is
        // a final answer or a clarifying question back to the user;
        // 'length'/'content-filter'/'error'/'other' are cases a later phase
        // can handle distinctly, but none of them mean "continue."
        if (finishReason !== 'tool-calls') {
          break;
        }

        if (step + 1 >= AgentService.MAX_STEPS) {
          const message = `Reached the ${AgentService.MAX_STEPS}-step limit for this turn while more tool calls were still requested.`;
          console.warn(
            `Agent loop hit MAX_STEPS on conversation ${conversationId}: ${message}`,
          );
          // Without this, the client only ever sees [DONE] with no
          // explanation for why the turn stopped mid-tool-use — reusing the
          // same error-chunk shape the catch block below uses, since there's
          // no dedicated "notice" chunk type and this is client-visible
          // information either way.
          res.write(
            `data: ${JSON.stringify({ type: 'error', errorText: message })}\n\n`,
          );
          break;
        }

        // response.messages is the SDK's own already-correctly-shaped
        // assistant/tool message pair for this step — no need to build it
        // by hand (toStepMessages still does that, but only for rehydrating
        // history from the database above, which stores our own decomposed
        // tool_calls/tool_results columns instead of this).
        currentMessages = [...currentMessages, ...response.messages];
      }
    } catch (err) {
      // Mirrors the non-leaking convention used everywhere else in this
      // codebase (GlobalExceptionFilter, the MCP error wrapper) — this
      // handler bypasses both by owning `res` directly, so it replicates
      // the same "log real error, send generic message" behavior itself.
      console.error('Agent stream failed:', err);
      try {
        res.write(
          `data: ${JSON.stringify({ type: 'error', errorText: INTERNAL_SERVER_ERROR_MESSAGE })}\n\n`,
        );
      } catch (writeErr) {
        // res.write can itself throw if the client already disconnected —
        // nothing upstream of this handler would catch that (this route
        // bypasses GlobalExceptionFilter), so it's handled right here
        // rather than risking an unhandled rejection.
        console.error(
          'Failed to write error chunk, client likely disconnected:',
          writeErr,
        );
      }
    } finally {
      // [DONE] matches the SDK's own SSE termination convention (see
      // JsonToSseTransformStream) — sent whether the loop finished
      // naturally or the catch block above just ran, so the client always
      // gets a clean end-of-stream signal rather than a hung connection.
      // Guarded by writableEnded since calling write/end again on an
      // already-ended response throws (e.g. the client disconnected
      // mid-stream and Node already tore the connection down).
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  }

  /**
   * Builds the assistant-message (+ following tool-role message, if there
   * were tool calls) pair for one past step's output, to rehydrate
   * conversation history from the database into real ModelMessages for a
   * new turn's first streamText call. Not used inside the loop itself —
   * there, result.response.messages already gives the SDK's own correctly
   * shaped equivalent for free. Returns just the assistant message alone
   * when there were no tool calls, since a plain-text step never needs a
   * following tool-role message.
   *
   * @param content - The step's text output, if any.
   * @param toolCalls - Tool calls made during the step, if any.
   * @param toolResults - Results of those tool calls, matched by toolCallId.
   */
  private toStepMessages(
    content: string,
    toolCalls: readonly ToolCallLike[],
    toolResults: readonly ToolResultLike[],
  ): ModelMessage[] {
    if (toolCalls.length === 0) {
      return [{ role: 'assistant', content }];
    }

    const toolCallParts: ToolCallPart[] = toolCalls.map((c) => ({
      type: 'tool-call',
      toolCallId: c.toolCallId,
      toolName: c.toolName,
      input: c.input,
    }));
    // Cast is safe, not just convenient: r.output originates from a real
    // ToolResultOutput value produced by streamText's own tool execution,
    // which only ever round-trips through JSON (jsonb column, then parsed
    // back) between here and there — the shape survives that round-trip
    // intact even though TypeScript can't see it through the `unknown` type
    // ToolResultLike declares.
    const toolResultParts: ToolResultPart[] = toolResults.map((r) => ({
      type: 'tool-result',
      toolCallId: r.toolCallId,
      toolName: r.toolName,
      output: r.output as ToolResultPart['output'],
    }));

    return [
      {
        role: 'assistant',
        content: content
          ? [{ type: 'text', text: content }, ...toolCallParts]
          : toolCallParts,
      },
      { role: 'tool', content: toolResultParts },
    ];
  }

  /**
   * Persists one step of a turn as its own agent_messages row. A step that
   * made no tool calls gets null tool_calls/tool_results, same shape phase
   * 2 used for a turn that never called a tool.
   *
   * @param conversationId - The conversation this step belongs to.
   * @param stepIndex - Which step within the turn this row represents.
   * @param content - The step's text output, if any.
   * @param toolCalls - Tool calls made during the step, if any.
   * @param toolResults - Results of those tool calls, matched by toolCallId.
   */
  private async persistAssistantStep(
    conversationId: number,
    stepIndex: number,
    content: string,
    toolCalls: readonly ToolCallLike[],
    toolResults: readonly ToolResultLike[],
  ): Promise<void> {
    const toolCallRecords: AgentToolCallRecord[] = toolCalls.map((c) => ({
      toolCallId: c.toolCallId,
      toolName: c.toolName,
      input: c.input,
    }));
    const toolResultRecords: AgentToolResultRecord[] = toolResults.map((r) => ({
      toolCallId: r.toolCallId,
      toolName: r.toolName,
      output: r.output,
    }));

    await this.dbService.kysely
      .insertInto('agent_messages')
      .values({
        conversation_id: conversationId,
        role: 'assistant',
        content,
        tool_calls:
          toolCallRecords.length > 0 ? JSON.stringify(toolCallRecords) : null,
        tool_results:
          toolResultRecords.length > 0
            ? JSON.stringify(toolResultRecords)
            : null,
        step_index: stepIndex,
      })
      .execute();
  }
}
