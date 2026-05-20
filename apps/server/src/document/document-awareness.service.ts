import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { REDIS_EVENTS, REDIS_KEYS } from '../redis/redis.events';
import { DatabaseService } from '../db/database.service';
import { AwarenessUser, AwarenessUserSchema } from '@converge/shared';

/** Distinct colors assigned to users on join; cycles from the start if all are taken. */
const AWARENESS_COLORS = [
  '#E03131',
  '#2F9E44',
  '#1971C2',
  '#F08C00',
  '#7048E8',
  '#C2255C',
  '#0C8599',
  '#5C940D',
];

/**
 * TTL applied to all awareness Redis keys on every interaction.
 * Long enough to survive passive sessions with no cursor activity;
 * auto-cleans stale entries if a server crashes before disconnect handlers run.
 */
const AWARENESS_TTL_SECONDS = 3600;

@Injectable()
export class DocumentAwarenessService {
  constructor(
    private readonly redisService: RedisService,
    private readonly dbService: DatabaseService,
  ) {}

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
    await this.redisService.expire(key, AWARENESS_TTL_SECONDS);
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
      await this.redisService.expire(key, AWARENESS_TTL_SECONDS);
    }
    return remaining === 0;
  }

  /**
   * Registers a user as present in the given document.
   * Fetches the user's name and avatar from the database, then writes an awareness
   * entry only if one does not already exist — preserving the existing color and
   * focusedBlockId from a previously opened tab. Refreshes TTL on both hashes.
   * @param documentId - the document the user is joining
   * @param userId - the authenticated user's database ID
   */
  async addUser(documentId: number, userId: number): Promise<void> {
    // Fetch name and avatarUrl from DB — not available on the socket or in the auth token.
    const user = await this.dbService.kysely
      .selectFrom('users')
      .select(['name', 'avatar_url'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) return; // Deleted account — skip silently.

    const awarenessKey = REDIS_KEYS.awareness(documentId);

    // Only create a new entry on the first tab; subsequent tabs leave the existing entry intact.
    const existing = await this.redisService.hget(awarenessKey, String(userId));
    if (!existing) {
      const users = await this.getUsers(documentId);
      const color = this.pickColor(users);
      const entry: AwarenessUser = {
        userId,
        name: user.name,
        avatarUrl: user.avatar_url,
        color,
        focusedBlockId: null,
      };
      await this.redisService.hset(
        awarenessKey,
        String(userId),
        JSON.stringify(entry),
      );
    }

    // Refresh TTL on both hashes to keep them alive for the duration of the session.
    await this.redisService.expire(awarenessKey, AWARENESS_TTL_SECONDS);
    await this.redisService.expire(
      REDIS_KEYS.awarenessSockets(documentId, userId),
      AWARENESS_TTL_SECONDS,
    );
  }

  /**
   * Updates the user's focusedBlockId in the awareness hash and refreshes the TTL
   * on both hashes. Silently skips if the entry has expired during a long idle session.
   * @param documentId - the document the user is in
   * @param userId - the user whose cursor position changed
   * @param focusedBlockId - the block the user focused, or null if focus was lost
   */
  async updateUser(
    documentId: number,
    userId: number,
    focusedBlockId: string | null,
  ): Promise<void> {
    const awarenessKey = REDIS_KEYS.awareness(documentId);

    const existing = await this.redisService.hget(awarenessKey, String(userId));
    if (!existing) return; // Entry expired — skip silently.

    const entry = this.parseEntry(existing);
    if (!entry) return;

    const updated: AwarenessUser = { ...entry, focusedBlockId };
    await this.redisService.hset(
      awarenessKey,
      String(userId),
      JSON.stringify(updated),
    );

    // Refresh TTL on both hashes on every cursor interaction.
    await this.redisService.expire(awarenessKey, AWARENESS_TTL_SECONDS);
    await this.redisService.expire(
      REDIS_KEYS.awarenessSockets(documentId, userId),
      AWARENESS_TTL_SECONDS,
    );
  }

  /**
   * Removes the user's entry from the awareness hash.
   * Called only when the user's last socket for this document disconnects.
   * @param documentId - the document the user is leaving
   * @param userId - the user to remove
   */
  async removeUser(documentId: number, userId: number): Promise<void> {
    await this.redisService.hdel(
      REDIS_KEYS.awareness(documentId),
      String(userId),
    );
  }

  /**
   * Reads the full awareness state from Redis, publishes it to the
   * `awareness-updates:{documentId}` pub/sub channel for other server instances,
   * and returns the user list so the caller can broadcast it locally.
   * @param documentId - the document to read and publish state for
   * @returns the current list of present users
   */
  async getAndPublishState(documentId: number): Promise<AwarenessUser[]> {
    const users = await this.getUsers(documentId);
    // Fire-and-forget — RedisService.publish handles its own error logging.
    this.redisService.publish(REDIS_EVENTS.awarenessUpdate(documentId), {
      users,
    });
    return users;
  }

  /**
   * Reads all entries from the `awareness:{documentId}` hash and returns them
   * as a parsed AwarenessUser array, silently dropping any malformed entries.
   * @param documentId - the document to read awareness state for
   */
  private async getUsers(documentId: number): Promise<AwarenessUser[]> {
    const hash = await this.redisService.hgetall(
      REDIS_KEYS.awareness(documentId),
    );
    return Object.values(hash)
      .map((raw) => this.parseEntry(raw))
      .filter((u): u is AwarenessUser => u !== null);
  }

  /**
   * Parses a raw JSON string from Redis into an AwarenessUser.
   * Returns null if the string is malformed or fails schema validation.
   * @param raw - the raw JSON string stored in the Redis hash field
   */
  private parseEntry(raw: string): AwarenessUser | null {
    try {
      return AwarenessUserSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  /**
   * Picks the first color from the palette not already used by an existing user.
   * Falls back to the first palette color if all are taken.
   * @param existingUsers - the current list of present users in the document
   */
  private pickColor(existingUsers: AwarenessUser[]): string {
    const usedColors = new Set(existingUsers.map((u) => u.color));
    return (
      AWARENESS_COLORS.find((c) => !usedColors.has(c)) ?? AWARENESS_COLORS[0]!
    );
  }
}
