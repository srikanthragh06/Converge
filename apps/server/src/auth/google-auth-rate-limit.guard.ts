import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { type Request } from 'express';
import { RedisService } from '../redis/redis.service.js';
import { REDIS_KEYS } from '../redis/redis.events.js';

/**
 * Rate-limits POST /auth/google before it can reach Google's token endpoint.
 * Enforces two independent windows: a per-IP cap (catches one source
 * flooding the endpoint) and a global cap shared across every caller
 * (catches distributed abuse — many IPs, each under the per-IP limit, that
 * still add up). Can't key on userId like UserThrottlerGuard does, since
 * this route runs before any identity is established.
 */
@Injectable()
export class GoogleAuthRateLimitGuard implements CanActivate {
  /** Max requests from a single IP within the window. */
  private static readonly IP_LIMIT = 8;

  /** Max requests across all callers combined within the window. */
  private static readonly GLOBAL_LIMIT = 300;

  /** Length of both windows, in seconds. */
  private static readonly WINDOW_SECONDS = 60;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Increments the per-IP and global counters and rejects with 429 if either
   * exceeds its limit. Requires app.set('trust proxy', 1) in main.ts so
   * req.ip reflects the real client rather than nginx's own address.
   * @param context - the execution context, used to reach the Express request
   * @returns true if both counters are within their limits
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // req.ip can be undefined if the underlying socket has already closed
    // (e.g. the client aborted mid-request) or isn't IP-based (e.g. a Unix
    // domain socket) — not something a client can trigger on purpose. Fail
    // closed rather than let an unidentifiable caller skip the per-IP check.
    if (request.ip === undefined) {
      throw new HttpException(
        'Unable to determine client address.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Per-IP window — catches one source flooding the endpoint.
    const ipCount = await this.redisService.incrWithExpire(
      REDIS_KEYS.googleAuthRateLimitIp(request.ip),
      GoogleAuthRateLimitGuard.WINDOW_SECONDS,
    );
    if (ipCount > GoogleAuthRateLimitGuard.IP_LIMIT) {
      throw new HttpException(
        'Too many login attempts. Please try again in 1-2 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Global window — catches distributed abuse: many IPs, each under the
    // per-IP limit, that still add up across every caller combined.
    const globalCount = await this.redisService.incrWithExpire(
      REDIS_KEYS.googleAuthRateLimitGlobal,
      GoogleAuthRateLimitGuard.WINDOW_SECONDS,
    );
    if (globalCount > GoogleAuthRateLimitGuard.GLOBAL_LIMIT) {
      throw new HttpException(
        'Login is temporarily rate-limited. Please try again in 1-2 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
