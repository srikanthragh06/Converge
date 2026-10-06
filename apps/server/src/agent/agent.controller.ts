import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { AgentService } from './agent.service.js';
import { httpOK } from '../utils/http-response.util.js';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe.js';
import {
  CreateAgentConversationRequestSchema,
  type CreateAgentConversationRequestDto,
  type CreateAgentConversationResponseDto,
  GetAgentConversationsRequestSchema,
  type GetAgentConversationsRequestDto,
  type GetAgentConversationsResponseDto,
  type GetAgentMessagesResponseDto,
  RenameAgentConversationRequestSchema,
  type RenameAgentConversationRequestDto,
  SendAgentMessageRequestSchema,
  type SendAgentMessageRequestDto,
} from '@converge/shared';

/**
 * Endpoints for the AI agent feature. Message sending streams its reply
 * directly onto the raw Express response rather than returning a value for
 * Nest to serialize — same tradeoff as McpController — so
 * GlobalExceptionFilter doesn't cover that handler; AgentService.sendMessage
 * handles its own mid-stream error case.
 */
@Controller('/agent')
@UseGuards(AuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * Starts a new conversation under the given workspace.
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @param body - The workspace to create the conversation under.
   * @returns The newly created conversation.
   */
  @Post('/conversations')
  async handleCreateConversation(
    @Req() req: Request,
    @Body(new ZodHttpValidationPipe(CreateAgentConversationRequestSchema))
    body: CreateAgentConversationRequestDto,
  ): Promise<CreateAgentConversationResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.agentService.createConversation(userId, body.workspaceId),
    );
  }

  /**
   * Lists the caller's own conversations under a workspace, newest first —
   * lets a client resume the most recent one instead of always starting a
   * new conversation.
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @param query - The workspace to list conversations under.
   */
  @Get('/conversations')
  async handleListConversations(
    @Req() req: Request,
    @Query(new ZodHttpValidationPipe(GetAgentConversationsRequestSchema))
    query: GetAgentConversationsRequestDto,
  ): Promise<GetAgentConversationsResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(
      await this.agentService.listConversations(userId, query.workspaceId),
    );
  }

  /**
   * Reads back a conversation's message history, for a frontend to
   * rehydrate a chat panel after a page refresh.
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @param conversationId - The conversation to read.
   */
  @Get('/conversations/:conversationId/messages')
  async handleGetMessages(
    @Req() req: Request,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ): Promise<GetAgentMessagesResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(await this.agentService.getMessages(userId, conversationId));
  }

  /**
   * Renames a conversation the caller owns. Throws 404 if it doesn't exist
   * or belongs to someone else — conversations aren't shared across users.
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @param conversationId - The conversation to rename.
   * @param body - The new title.
   */
  @Patch('/conversations/:conversationId')
  async handleRenameConversation(
    @Req() req: Request,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Body(new ZodHttpValidationPipe(RenameAgentConversationRequestSchema))
    body: RenameAgentConversationRequestDto,
  ): Promise<void> {
    const userId = (req as any).userId as number;
    await this.agentService.renameConversation(
      userId,
      conversationId,
      body.title,
    );
  }

  /**
   * Deletes a conversation the caller owns, along with all its messages.
   * Throws 404 if it doesn't exist or belongs to someone else. Hard delete —
   * no trash/restore for conversations, unlike documents.
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @param conversationId - The conversation to delete.
   */
  @Delete('/conversations/:conversationId')
  async handleDeleteConversation(
    @Req() req: Request,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ): Promise<void> {
    const userId = (req as any).userId as number;
    await this.agentService.deleteConversation(userId, conversationId);
  }

  /**
   * Sends a single chat message into an existing conversation and streams
   * the assistant's reply back as hand-rolled SSE (see AgentService's class
   * doc comment for why this isn't any SDK's built-in stream protocol).
   *
   * @param req - The Express request with userId stamped by AuthGuard.
   * @param body - The conversation to post into and the message content.
   * @param res - The raw Express response the reply is streamed onto.
   */
  @Post('/messages')
  async handleSendMessage(
    @Req() req: Request,
    @Body(new ZodHttpValidationPipe(SendAgentMessageRequestSchema))
    body: SendAgentMessageRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    const userId = (req as any).userId as number;
    await this.agentService.sendMessage(userId, body, res);
  }
}
