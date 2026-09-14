import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service.js';
import { REDIS_KEYS } from '../redis/redis.events.js';

/** One reranked candidate — index into the original candidates array passed to rerank, plus Voyage's own relevance score. */
export interface RerankedCandidate {
  index: number;
  relevanceScore: number;
}

/**
 * Thin wrapper around Voyage's rerank endpoint. Candidates in, relevance-
 * sorted order out — no document/chunk/DB knowledge of its own, same split
 * as DocumentEmbeddingService for OpenAI. No SDK dependency needed for a
 * single POST call.
 */
@Injectable()
export class DocumentRerankService {
  private static readonly RERANK_MODEL = 'rerank-3'; // Voyage's cross-encoder reranker model.

  /** Max rerank calls from a single user within the window. */
  private static readonly USER_LIMIT = 10;

  /** Max rerank calls from a single workspace within the window. */
  private static readonly WORKSPACE_LIMIT = 50;

  /** Max rerank calls across every caller combined within the window — kept under Voyage's own 2000rpm account limit. */
  private static readonly GLOBAL_LIMIT = 1800;

  /** Length of all three windows, in seconds. */
  private static readonly WINDOW_SECONDS = 60;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Reranks a set of candidate texts against a query using Voyage's
   * rerank-3 cross-encoder, which reads the query and each candidate
   * together rather than comparing independently-computed scores.
   * @param query - the search query
   * @param candidates - candidate texts to rerank, in the order the caller
   * will index back into
   * @param topK - maximum number of results to return
   * @param userId - the calling user, for the per-user rate limit tier
   * @param workspaceId - the workspace being searched, for the per-workspace rate limit tier
   * @returns candidates re-sorted by relevance, most relevant first
   */
  async rerank(
    query: string,
    candidates: string[],
    topK: number,
    userId: number,
    workspaceId: number,
  ): Promise<RerankedCandidate[]> {
    await this.checkRateLimit(userId, workspaceId);

    // Read lazily here rather than in the constructor (unlike
    // DocumentEmbeddingService's eager OPENAI_API_KEY read) — VOYAGE_API_KEY
    // isn't required for the app to function yet, and NestJS eagerly
    // constructs every provider at boot, so validating it in the
    // constructor would stop the whole server from starting whenever the
    // key isn't configured, not just this one feature.
    const apiKey = this.configService.getOrThrow<string>('VOYAGE_API_KEY');

    // Single POST, no retry — a failure (including a 429) surfaces directly
    // to the caller rather than being silently retried.
    const response = await fetch('https://api.voyageai.com/v1/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DocumentRerankService.RERANK_MODEL,
        query,
        documents: candidates,
        top_k: topK,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Voyage rerank request failed: ${response.status} ${await response.text()}`,
      );
    }

    const body = (await response.json()) as {
      data: { index: number; relevance_score: number }[];
    };
    return body.data.map((d) => ({
      index: d.index,
      relevanceScore: d.relevance_score,
    }));
  }

  /**
   * Enforces the three rate-limit tiers before a rerank call reaches Voyage:
   * per-user, then per-workspace, then global. Checked in that order —
   * cheapest/most-specific first — so a caller already over their own cap
   * short-circuits without spending Redis round-trips on the wider tiers,
   * same pattern as GoogleAuthRateLimitGuard's IP-then-global check.
   * @param userId - the calling user
   * @param workspaceId - the workspace being searched
   */
  private async checkRateLimit(
    userId: number,
    workspaceId: number,
  ): Promise<void> {
    const userCount = await this.redisService.incrWithExpire(
      REDIS_KEYS.voyageRerankRateLimitUser(userId),
      DocumentRerankService.WINDOW_SECONDS,
    );
    if (userCount > DocumentRerankService.USER_LIMIT) {
      throw new HttpException(
        'Search is temporarily rate-limited for your account. Please try again in 1-2 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const workspaceCount = await this.redisService.incrWithExpire(
      REDIS_KEYS.voyageRerankRateLimitWorkspace(workspaceId),
      DocumentRerankService.WINDOW_SECONDS,
    );
    if (workspaceCount > DocumentRerankService.WORKSPACE_LIMIT) {
      throw new HttpException(
        'Search is temporarily rate-limited for this workspace. Please try again in 1-2 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const globalCount = await this.redisService.incrWithExpire(
      REDIS_KEYS.voyageRerankRateLimitGlobal,
      DocumentRerankService.WINDOW_SECONDS,
    );
    if (globalCount > DocumentRerankService.GLOBAL_LIMIT) {
      throw new HttpException(
        'Search is temporarily rate-limited. Please try again in 1-2 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
