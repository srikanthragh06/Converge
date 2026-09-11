import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { AgentService } from './agent.service.js';
import { httpOK } from '../utils/http-response.util.js';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe.js';
import {
  CreateAgentConversationRequestSchema,
  type CreateAgentConversationRequestDto,
  type CreateAgentConversationResponseDto,
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
   * Sends a single chat message into an existing conversation and streams
   * the assistant's reply back via the AI SDK's UI message stream protocol.
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
