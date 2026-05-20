import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { REDIS_KEYS } from '../redis/redis.events';

/** TTL applied to awareness-sockets keys — expires stale entries if the server crashes mid-session. */
const AWARENESS_SOCKETS_TTL_SECONDS = 3600;

@Injectable()
export class DocumentAwarenessService {
  constructor(private readonly redisService: RedisService) {}

  /**
   * Registers a socket as active for the given user in the given document.
   * Adds the socketId to the awareness-sockets Set and refreshes the TTL.
   * @param documentId - the document the socket is connecting to
   * @param userId - the authenticated user
   * @param socketId - the Socket.io socket ID
   */
  async addSocket(
    documentId: number,
    userId: number,
    socketId: string,
  ): Promise<void> {
    const key = REDIS_KEYS.awarenessSockets(documentId, userId);
    await this.redisService.sadd(key, socketId);
    await this.redisService.expire(key, AWARENESS_SOCKETS_TTL_SECONDS);
  }

  /**
   * Removes a socket from the active set for the given user in the given document.
   * Refreshes the TTL if other sockets remain.
   * @param documentId - the document the socket is disconnecting from
   * @param userId - the authenticated user
   * @param socketId - the Socket.io socket ID
   * @returns true if this was the user's last socket for this document, false otherwise
   */
  async removeSocket(
    documentId: number,
    userId: number,
    socketId: string,
  ): Promise<boolean> {
    const key = REDIS_KEYS.awarenessSockets(documentId, userId);
    await this.redisService.srem(key, socketId);
    const remaining = await this.redisService.scard(key);
    if (remaining > 0) {
      await this.redisService.expire(key, AWARENESS_SOCKETS_TTL_SECONDS);
    }
    return remaining === 0;
  }
}
