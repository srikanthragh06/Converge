import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { type Request } from 'express';

/**
 * Extends ThrottlerGuard to key rate limits on the authenticated user's ID
 * instead of the default IP address. This ensures limits are per-user rather
 * than per-network, preventing shared IPs from exhausting each other's quota.
 * Requires AuthGuard to run first so userId is already stamped on the request.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  /**
   * Returns the authenticated user's ID as the throttle tracking key so rate
   * limits are enforced per user rather than per IP address.
   * @param req - the Express request, with userId stamped by AuthGuard
   * @returns the user's ID as a string, used as the throttle bucket key
   */
  protected async getTracker(req: Request): Promise<string> {
    return (req as any).userId.toString();
  }
}
