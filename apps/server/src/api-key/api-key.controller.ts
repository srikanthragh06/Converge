import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { type Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import { ApiKeyService } from './api-key.service.js';
import { httpOK } from '../utils/http-response.util.js';
import { ZodHttpValidationPipe } from '../pipes/zod-http-validation.pipe.js';
import {
  CreateApiKeyRequestSchema,
  type CreateApiKeyRequestDto,
  type CreateApiKeyResponseDto,
  type GetApiKeysResponseDto,
} from '@converge/shared';

// Manages a user's own API keys — session-authenticated, since key
// management happens through the browser. The keys themselves are used
// elsewhere (e.g. McpController) via ApiKeyGuard, not here.
@Controller('/api-keys')
@UseGuards(AuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * Creates a new API key for the authenticated user. The raw key is
   * returned once, in this response, and is never retrievable again.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param body - the requested key's label
   */
  @Post('/')
  async handleCreateApiKey(
    @Req() req: Request,
    @Body(new ZodHttpValidationPipe(CreateApiKeyRequestSchema))
    { label }: CreateApiKeyRequestDto,
  ): Promise<CreateApiKeyResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(await this.apiKeyService.createApiKey(userId, label));
  }

  /**
   * Lists the authenticated user's API keys, newest first. Never includes
   * the raw key or its hash.
   * @param req - the Express request, with userId stamped by AuthGuard
   */
  @Get('/')
  async handleGetApiKeys(@Req() req: Request): Promise<GetApiKeysResponseDto> {
    const userId = (req as any).userId as number;
    return httpOK(await this.apiKeyService.listApiKeys(userId));
  }

  /**
   * Revokes one of the authenticated user's API keys. Scoped to the
   * requesting user, so this cannot revoke another user's key.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @param keyId - the API key row's ID, parsed from the URL path
   */
  @Delete('/:id')
  async handleRevokeApiKey(
    @Req() req: Request,
    @Param('id', ParseIntPipe) keyId: number,
  ): Promise<void> {
    const userId = (req as any).userId as number;
    await this.apiKeyService.revokeApiKey(userId, keyId);
  }
}
