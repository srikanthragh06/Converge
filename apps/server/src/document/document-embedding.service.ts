import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { RedisService } from '../redis/redis.service.js';
import { REDIS_KEYS } from '../redis/redis.events.js';
import { countTokens } from '../utils/chunking.util.js';

/**
 * Thin wrapper around OpenAI's embeddings API. Text in, vector out — no
 * document/chunk/DB knowledge of its own, so DocumentIndexingService is
 * free to call it per-chunk without this service caring what a chunk is.
 */
@Injectable()
export class DocumentEmbeddingService {
  private readonly openai: OpenAI; // OpenAI SDK client, constructed once per instance with the configured API key.

  // text-embedding-3-small: 1536-dimensional output, matching the
  // vector(1536) column document_chunks.embedding was migrated with.
  private static readonly EMBEDDING_MODEL = 'text-embedding-3-small';

  /** Max embedding calls from a single user within the window (search path only). */
  private static readonly USER_RPM_LIMIT = 20;

  /** Max embedding tokens from a single user within the window (search path only). */
  private static readonly USER_TPM_LIMIT = 6000;

  /** Max embedding calls from a single workspace within the window. */
  private static readonly WORKSPACE_RPM_LIMIT = 300;

  /** Max embedding tokens from a single workspace within the window. */
  private static readonly WORKSPACE_TPM_LIMIT = 100_000;

  /** Max embedding calls across every caller combined within the window — kept under OpenAI's own 3,000rpm account limit. */
  private static readonly GLOBAL_RPM_LIMIT = 2700;

  /** Max embedding tokens across every caller combined within the window — kept under OpenAI's own 1,000,000tpm account limit. */
  private static readonly GLOBAL_TPM_LIMIT = 900_000;

  /** Length of every request/token window, in seconds. */
  private static readonly WINDOW_SECONDS = 60;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    // Passed explicitly rather than relying on the SDK's implicit
    // process.env.OPENAI_API_KEY read, matching how every other service in
    // this app sources config through ConfigService.
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Embeds a string via OpenAI's text-embedding-3-small model.
   * @param text - the text to embed, e.g. a chunk's Markdown content
   * @param workspaceId - the workspace this embedding is for, for the per-workspace rate limit tier
   * @param userId - the calling user, for the per-user rate limit tier — omitted by background indexing, which has no single user to attribute the call to
   * @returns the embedding as a 1536-length array of floats
   */
  async embed(
    text: string,
    workspaceId: number,
    userId?: number,
  ): Promise<number[]> {
    await this.checkRateLimit(countTokens(text), workspaceId, userId);

    // A single string input always returns exactly one embedding.
    const response = await this.openai.embeddings.create({
      model: DocumentEmbeddingService.EMBEDDING_MODEL,
      input: text,
    });
    return response.data[0].embedding;
  }

  /**
   * Enforces the rate-limit tiers before an embed call reaches OpenAI: an
   * optional per-user tier, then per-workspace, then global — cheapest/most-
   * specific first, so a caller already over their own cap short-circuits
   * without spending Redis round-trips on the wider tiers, same pattern as
   * GoogleAuthRateLimitGuard and DocumentRerankService. Each tier checks
   * both a request-count and a token-count window, since OpenAI enforces
   * RPM and TPM as independent constraints — a flood of many small calls
   * can exhaust RPM well before TPM does.
   * @param tokens - the input text's token count, charged against the token-count windows
   * @param workspaceId - the workspace being embedded for
   * @param userId - the calling user, omitted when there is none (background indexing)
   */
  private async checkRateLimit(
    tokens: number,
    workspaceId: number,
    userId?: number,
  ): Promise<void> {
    if (userId !== undefined) {
      await this.checkTierLimit(
        REDIS_KEYS.openaiEmbeddingRateLimitUserRequests(userId),
        DocumentEmbeddingService.USER_RPM_LIMIT,
        REDIS_KEYS.openaiEmbeddingRateLimitUserTokens(userId),
        DocumentEmbeddingService.USER_TPM_LIMIT,
        tokens,
        'Search is temporarily rate-limited for your account. Please try again shortly.',
      );
    }

    await this.checkTierLimit(
      REDIS_KEYS.openaiEmbeddingRateLimitWorkspaceRequests(workspaceId),
      DocumentEmbeddingService.WORKSPACE_RPM_LIMIT,
      REDIS_KEYS.openaiEmbeddingRateLimitWorkspaceTokens(workspaceId),
      DocumentEmbeddingService.WORKSPACE_TPM_LIMIT,
      tokens,
      'Embedding is temporarily rate-limited for this workspace. Please try again shortly.',
    );

    await this.checkTierLimit(
      REDIS_KEYS.openaiEmbeddingRateLimitGlobalRequests,
      DocumentEmbeddingService.GLOBAL_RPM_LIMIT,
      REDIS_KEYS.openaiEmbeddingRateLimitGlobalTokens,
      DocumentEmbeddingService.GLOBAL_TPM_LIMIT,
      tokens,
      'Embedding is temporarily rate-limited. Please try again shortly.',
    );
  }

  /**
   * Checks one rate-limit tier's request-count and token-count windows,
   * incrementing both regardless of caller identity (user/workspace/global
   * share this same shape, just different keys and limits).
   * @param requestsKey - the Redis key for this tier's request-count window
   * @param requestLimit - max requests allowed in the window
   * @param tokensKey - the Redis key for this tier's token-count window
   * @param tokenLimit - max tokens allowed in the window
   * @param tokens - this call's token count, added to the token-count window
   * @param message - the 429 message to surface if either window is exceeded
   */
  private async checkTierLimit(
    requestsKey: string,
    requestLimit: number,
    tokensKey: string,
    tokenLimit: number,
    tokens: number,
    message: string,
  ): Promise<void> {
    const requestCount = await this.redisService.incrWithExpire(
      requestsKey,
      DocumentEmbeddingService.WINDOW_SECONDS,
    );
    if (requestCount > requestLimit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }

    const tokenCount = await this.redisService.incrByWithExpire(
      tokensKey,
      tokens,
      DocumentEmbeddingService.WINDOW_SECONDS,
    );
    if (tokenCount > tokenLimit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
