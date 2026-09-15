import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
import { REDIS_KEYS } from '../redis/redis.events.js';

/** Redis key set for one rate-limit tier (user, workspace, or global). */
interface RateLimitTierKeys {
  /** Key for this tier's per-minute request-count window. */
  requestsMinute: string;
  /** Key for this tier's per-minute token-count window. */
  tokensMinute: string;
  /** Key for this tier's per-day request-count window. */
  requestsDay: string;
  /** Key for this tier's per-day token-count window. */
  tokensDay: string;
}

/**
 * Enforces request- and token-count budgets on the agent's OpenAI Responses
 * API calls, checked once per step inside AgentService's loop — not once
 * per HTTP request — since a single POST /agent/messages call can trigger
 * up to AgentService.MAX_STEPS real OpenAI calls. Three tiers (user,
 * workspace, global) each get an independent per-minute and per-day budget,
 * cheapest/most-specific checked first, same ordering
 * DocumentEmbeddingService.checkRateLimit uses.
 *
 * Token budgets can't be enforced pre-flight the way DocumentEmbeddingService
 * enforces its own: that service sends a known text string it can tokenize
 * itself before calling OpenAI, but the agent's previous_response_id
 * chaining means a step's real prompt (the full accumulated conversation,
 * reconstructed server-side by OpenAI) is never fully visible to this app.
 * So token budgets here are checked against the running total already
 * recorded from *previous* calls (checkAndReserve), and only updated with
 * the *actual* usage OpenAI reports back after a call completes
 * (recordUsage) — one call can land slightly over budget before the next
 * one gets blocked, an acceptable tradeoff for a real number over a guess.
 * Request budgets don't have this problem (a step is always exactly one
 * request) and are checked and incremented together, in the same call.
 */
@Injectable()
export class AgentRateLimitService {
  // gpt-5.6-luna's account limits are 500 RPM / 500,000 TPM; the global
  // tier's limits below are kept at 90% headroom against those, same ratio
  // DocumentEmbeddingService's global tier uses against its own provider
  // limits.
  /** Max agent OpenAI calls across every caller combined within a minute. */
  private static readonly GLOBAL_RPM_LIMIT = 450;
  /** Max agent OpenAI tokens across every caller combined within a minute. */
  private static readonly GLOBAL_TPM_LIMIT = 450_000;
  /** Max agent OpenAI calls from a single workspace within a minute. */
  private static readonly WORKSPACE_RPM_LIMIT = 100;
  /** Max agent OpenAI tokens from a single workspace within a minute. */
  private static readonly WORKSPACE_TPM_LIMIT = 100_000;
  /** Max agent OpenAI calls from a single user within a minute. */
  private static readonly USER_RPM_LIMIT = 30;
  /** Max agent OpenAI tokens from a single user within a minute. */
  private static readonly USER_TPM_LIMIT = 30_000;

  // Daily budgets are a pure cost backstop, independent of OpenAI's own
  // (per-minute only) account limits — a caller well under the per-minute
  // caps could still run up a large bill over a full day of steady use.
  /** Max agent OpenAI calls across every caller combined within a day. */
  private static readonly GLOBAL_RPD_LIMIT = 5_000;
  /** Max agent OpenAI tokens across every caller combined within a day. */
  private static readonly GLOBAL_TPD_LIMIT = 2_000_000;
  /** Max agent OpenAI calls from a single workspace within a day. */
  private static readonly WORKSPACE_RPD_LIMIT = 2_000;
  /** Max agent OpenAI tokens from a single workspace within a day. */
  private static readonly WORKSPACE_TPD_LIMIT = 800_000;
  /** Max agent OpenAI calls from a single user within a day. */
  private static readonly USER_RPD_LIMIT = 1_000;
  /** Max agent OpenAI tokens from a single user within a day. */
  private static readonly USER_TPD_LIMIT = 300_000;

  /** Length of every per-minute window, in seconds. */
  private static readonly MINUTE_WINDOW_SECONDS = 60;
  /** Length of every per-day window, in seconds. */
  private static readonly DAY_WINDOW_SECONDS = 24 * 60 * 60;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Checked before every OpenAI Responses API call the agent loop makes.
   * Increments and checks each tier's request-count windows (a call always
   * costs exactly one request, known upfront); checks — without
   * incrementing — each tier's token-count windows against whatever total
   * recordUsage has already recorded for it. Throws 429 on the first
   * tier/window found over budget.
   * @param userId - the calling user, for the per-user tier
   * @param workspaceId - the conversation's workspace, for the per-workspace tier
   */
  async checkAndReserve(userId: number, workspaceId: number): Promise<void> {
    await this.checkTier(
      {
        requestsMinute: REDIS_KEYS.agentRateLimitUserRequestsMinute(userId),
        tokensMinute: REDIS_KEYS.agentRateLimitUserTokensMinute(userId),
        requestsDay: REDIS_KEYS.agentRateLimitUserRequestsDay(userId),
        tokensDay: REDIS_KEYS.agentRateLimitUserTokensDay(userId),
      },
      AgentRateLimitService.USER_RPM_LIMIT,
      AgentRateLimitService.USER_TPM_LIMIT,
      AgentRateLimitService.USER_RPD_LIMIT,
      AgentRateLimitService.USER_TPD_LIMIT,
      'The agent is temporarily rate-limited for your account. Please try again shortly.',
    );

    await this.checkTier(
      {
        requestsMinute:
          REDIS_KEYS.agentRateLimitWorkspaceRequestsMinute(workspaceId),
        tokensMinute:
          REDIS_KEYS.agentRateLimitWorkspaceTokensMinute(workspaceId),
        requestsDay: REDIS_KEYS.agentRateLimitWorkspaceRequestsDay(workspaceId),
        tokensDay: REDIS_KEYS.agentRateLimitWorkspaceTokensDay(workspaceId),
      },
      AgentRateLimitService.WORKSPACE_RPM_LIMIT,
      AgentRateLimitService.WORKSPACE_TPM_LIMIT,
      AgentRateLimitService.WORKSPACE_RPD_LIMIT,
      AgentRateLimitService.WORKSPACE_TPD_LIMIT,
      'The agent is temporarily rate-limited for this workspace. Please try again shortly.',
    );

    await this.checkTier(
      {
        requestsMinute: REDIS_KEYS.agentRateLimitGlobalRequestsMinute,
        tokensMinute: REDIS_KEYS.agentRateLimitGlobalTokensMinute,
        requestsDay: REDIS_KEYS.agentRateLimitGlobalRequestsDay,
        tokensDay: REDIS_KEYS.agentRateLimitGlobalTokensDay,
      },
      AgentRateLimitService.GLOBAL_RPM_LIMIT,
      AgentRateLimitService.GLOBAL_TPM_LIMIT,
      AgentRateLimitService.GLOBAL_RPD_LIMIT,
      AgentRateLimitService.GLOBAL_TPD_LIMIT,
      'The agent is temporarily rate-limited. Please try again shortly.',
    );
  }

  /**
   * Records a completed call's real token cost against every tier's
   * token-count windows, so the next checkAndReserve call sees an accurate
   * running total instead of a pre-call estimate.
   * @param userId - the calling user
   * @param workspaceId - the conversation's workspace
   * @param tokens - the call's actual total_tokens, from the Responses API's own usage field
   */
  async recordUsage(
    userId: number,
    workspaceId: number,
    tokens: number,
  ): Promise<void> {
    await Promise.all([
      this.redisService.incrByWithExpire(
        REDIS_KEYS.agentRateLimitUserTokensMinute(userId),
        tokens,
        AgentRateLimitService.MINUTE_WINDOW_SECONDS,
      ),
      this.redisService.incrByWithExpire(
        REDIS_KEYS.agentRateLimitUserTokensDay(userId),
        tokens,
        AgentRateLimitService.DAY_WINDOW_SECONDS,
      ),
      this.redisService.incrByWithExpire(
        REDIS_KEYS.agentRateLimitWorkspaceTokensMinute(workspaceId),
        tokens,
        AgentRateLimitService.MINUTE_WINDOW_SECONDS,
      ),
      this.redisService.incrByWithExpire(
        REDIS_KEYS.agentRateLimitWorkspaceTokensDay(workspaceId),
        tokens,
        AgentRateLimitService.DAY_WINDOW_SECONDS,
      ),
      this.redisService.incrByWithExpire(
        REDIS_KEYS.agentRateLimitGlobalTokensMinute,
        tokens,
        AgentRateLimitService.MINUTE_WINDOW_SECONDS,
      ),
      this.redisService.incrByWithExpire(
        REDIS_KEYS.agentRateLimitGlobalTokensDay,
        tokens,
        AgentRateLimitService.DAY_WINDOW_SECONDS,
      ),
    ]);
  }

  /**
   * Checks one tier's minute and day windows. Request-count windows are
   * incremented and checked together (a step is always exactly one
   * request). Token-count windows are only read — see the class doc
   * comment for why — and checked against the running total recordUsage
   * has already accumulated for them.
   * @param keys - this tier's four Redis keys
   * @param rpmLimit - max requests allowed per minute
   * @param tpmLimit - max tokens allowed per minute
   * @param rpdLimit - max requests allowed per day
   * @param tpdLimit - max tokens allowed per day
   * @param message - the 429 message to surface if any window is exceeded
   */
  private async checkTier(
    keys: RateLimitTierKeys,
    rpmLimit: number,
    tpmLimit: number,
    rpdLimit: number,
    tpdLimit: number,
    message: string,
  ): Promise<void> {
    const requestsMinute = await this.redisService.incrWithExpire(
      keys.requestsMinute,
      AgentRateLimitService.MINUTE_WINDOW_SECONDS,
    );
    if (requestsMinute > rpmLimit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }

    const requestsDay = await this.redisService.incrWithExpire(
      keys.requestsDay,
      AgentRateLimitService.DAY_WINDOW_SECONDS,
    );
    if (requestsDay > rpdLimit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }

    const tokensMinute = await this.redisService.getCounter(keys.tokensMinute);
    if (tokensMinute > tpmLimit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }

    const tokensDay = await this.redisService.getCounter(keys.tokensDay);
    if (tokensDay > tpdLimit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
