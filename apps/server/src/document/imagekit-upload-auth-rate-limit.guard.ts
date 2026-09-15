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
 * Rate-limits GET /document/upload-auth per user. Each call mints a valid
 * ImageKit upload credential, so uncapped calls could fill storage with junk.
 * Requires AuthGuard to run first so userId is already stamped on the request.
 */
@Injectable()
export class ImageKitUploadAuthRateLimitGuard implements CanActivate {
  /** Max requests from a single user within the window. */
  private static readonly USER_LIMIT = 10;

  /** Length of the window, in seconds. */
  private static readonly WINDOW_SECONDS = 60;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Increments the per-user counter and rejects with 429 if it exceeds the limit.
   * @param context - the execution context, used to reach the Express request
   * @returns true if the counter is within the limit
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = (request as any).userId as number;

    // Per-user window — caps how many upload credentials one user can mint.
    const userCount = await this.redisService.incrWithExpire(
      REDIS_KEYS.imageKitUploadAuthRateLimitUser(userId),
      ImageKitUploadAuthRateLimitGuard.WINDOW_SECONDS,
    );
    if (userCount > ImageKitUploadAuthRateLimitGuard.USER_LIMIT) {
      throw new HttpException(
        'Too many upload requests. Please try again in 1-2 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
