import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
import { REDIS_EVENTS, REDIS_KEYS } from '../redis/redis.events.js';
import { DatabaseService } from '../db/database.service.js';
import { AwarenessUser, AwarenessUserSchema } from '@converge/shared';
import { DocumentAccessService } from './document-access.service.js';

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
 * TTL applied to both awareness Redis keys on every connect, cursor update
 * and heartbeat. Open sockets keep refreshing it, so it only cleans up a
 * document that nobody has open any more.
 */
const AWARENESS_TTL_SECONDS = 3600;

/**
 * How long a socket may go without a heartbeat before it counts as gone.
 * The client sends one every 15s, but Chrome runs the timers of a tab hidden
 * for over 5 minutes only about once a minute, so this leaves room for that.
 */
const AWARENESS_SOCKET_TIMEOUT_MS = 90_000;

@Injectable()
export class DocumentAwarenessService {
  constructor(
    private readonly redisService: RedisService,
    private readonly dbService: DatabaseService,
    private readonly documentAccessService: DocumentAccessService,
  ) {}

  /**
   * Registers a socket as open in the given document, or marks an already
   * registered socket as seen now. Writes the socket into the awareness-sockets
   * sorted set with the current time as its score and refreshes the TTL.
   * @param documentId - the document the socket is connected to
   * @param userId - the authenticated user
   * @param socketId - the Socket.io socket ID
   */
  async addSocket(
    documentId: number,
    userId: number,
    socketId: string,
  ): Promise<void> {
    const key = REDIS_KEYS.awarenessSockets(documentId);
    await this.redisService.zadd(
      key,
      Date.now(),
      this.socketMember(userId, socketId),
    );
    await this.redisService.expire(key, AWARENESS_TTL_SECONDS);
  }

  /**
   * Removes a socket from the document's open sockets.
   * @param documentId - the document the socket is disconnecting from
   * @param userId - the authenticated user
   * @param socketId - the Socket.io socket ID
   * @returns true if the user has no other live socket in this document, false otherwise
   */
  async removeSocket(
    documentId: number,
    userId: number,
    socketId: string,
  ): Promise<boolean> {
    const key = REDIS_KEYS.awarenessSockets(documentId);
    await this.redisService.zrem(key, this.socketMember(userId, socketId));
    const liveUserIds = await this.getLiveUserIds(documentId);
    return !liveUserIds.has(userId);
  }

  /**
   * Handles a socket's periodic heartbeat. Marks the socket as seen now,
   * adds the user's awareness entry again if it is missing, and removes the
   * entries of users who have no live socket left. A missing entry happens
   * when a reload's disconnect removes the user while the new tab connects;
   * a user with no live socket is left behind when a server stops before its
   * disconnect handler runs (crash, kill, deploy).
   * @param documentId - the document the socket is connected to
   * @param userId - the authenticated user
   * @param socketId - the Socket.io socket ID
   * @returns true if the presence list changed and should be broadcast
   */
  async heartbeat(
    documentId: number,
    userId: number,
    socketId: string,
  ): Promise<boolean> {
    await this.addSocket(documentId, userId, socketId);

    let changed = false;
    const awarenessKey = REDIS_KEYS.awareness(documentId);
    const existing = await this.redisService.hget(awarenessKey, String(userId));
    if (existing) {
      await this.redisService.expire(awarenessKey, AWARENESS_TTL_SECONDS);
    } else {
      await this.addUser(documentId, userId);
      changed = true;
    }

    const removedSilentUsers = await this.removeSilentUsers(documentId);
    if (removedSilentUsers) {
      changed = true;
    }
    return changed;
  }

  /**
   * Registers a user as present in the given document.
   * Fetches the user's name, email, and avatar from the database and resolves their
   * access level, then writes an awareness entry only if one does not already exist —
   * preserving the existing color and focusedBlockId from a previously opened tab.
   * Refreshes TTL on both hashes.
   * @param documentId - the document the user is joining
   * @param userId - the authenticated user's database ID
   */
  async addUser(documentId: number, userId: number): Promise<void> {
    // Fetch name, email, and avatarUrl from DB — not available on the socket or in the auth token.
    const user = await this.dbService.kysely
      .selectFrom('users')
      .select(['name', 'email', 'avatar_url'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) return; // Deleted account — skip silently.

    const awarenessKey = REDIS_KEYS.awareness(documentId);

    // Only create a new entry on the first tab; subsequent tabs leave the existing entry intact.
    const existing = await this.redisService.hget(awarenessKey, String(userId));
    if (!existing) {
      const users = await this.getUsers(documentId);
      // Resolve access level at join time. Not a permanent cache — updateUser
      // re-resolves it on every cursor interaction, so this initial value only
      // covers the window before the user's first focus/cursor update.
      const accessLevel = await this.documentAccessService.resolveAccess(
        documentId,
        userId,
      );
      const color = this.pickColor(users);
      const entry: AwarenessUser = {
        userId,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        color,
        focusedBlockId: null,
        accessLevel,
      };
      await this.redisService.hset(
        awarenessKey,
        String(userId),
        JSON.stringify(entry),
      );
    }

    // Refresh TTL on both keys to keep them alive for the duration of the session.
    await this.redisService.expire(awarenessKey, AWARENESS_TTL_SECONDS);
    await this.redisService.expire(
      REDIS_KEYS.awarenessSockets(documentId),
      AWARENESS_TTL_SECONDS,
    );
  }

  /**
   * Updates the user's focusedBlockId and access level in the awareness hash,
   * then refreshes the TTL on both hashes. Access is re-resolved on every call
   * rather than carried forward from the existing entry, so the presence
   * badge reflects a mid-session grant/revoke/role change instead of freezing
   * at whatever was resolved when the user's first tab opened. Adds the entry
   * again first if it is missing, so the user does not stay hidden.
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

    let existing = await this.redisService.hget(awarenessKey, String(userId));
    if (!existing) {
      await this.addUser(documentId, userId);
      existing = await this.redisService.hget(awarenessKey, String(userId));
      if (!existing) return; // Deleted account — addUser wrote nothing.
    }

    const entry = this.parseEntry(existing);
    if (!entry) return;

    // Re-resolve access fresh rather than reusing entry.accessLevel — see
    // the doc comment above for why.
    const accessLevel = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );

    const updated: AwarenessUser = { ...entry, focusedBlockId, accessLevel };
    await this.redisService.hset(
      awarenessKey,
      String(userId),
      JSON.stringify(updated),
    );

    // Refresh TTL on both keys on every cursor interaction.
    await this.redisService.expire(awarenessKey, AWARENESS_TTL_SECONDS);
    await this.redisService.expire(
      REDIS_KEYS.awarenessSockets(documentId),
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
   * Removes the awareness entry of every user who has no live socket left in
   * the document.
   * @param documentId - the document to clean up
   * @returns true if at least one entry was removed
   */
  private async removeSilentUsers(documentId: number): Promise<boolean> {
    const awarenessKey = REDIS_KEYS.awareness(documentId);

    // Read the entries before the live sockets. A joining user writes their
    // socket before their entry, so a user whose entry is read here already
    // has their socket in the live list and is never removed by mistake.
    const hash = await this.redisService.hgetall(awarenessKey);
    const liveUserIds = await this.getLiveUserIds(documentId);

    const silentFields: string[] = [];
    for (const field of Object.keys(hash)) {
      if (!liveUserIds.has(Number(field))) {
        silentFields.push(field);
      }
    }

    if (silentFields.length === 0) {
      return false;
    }
    await this.redisService.hdel(awarenessKey, ...silentFields);
    return true;
  }

  /**
   * Removes sockets that have gone without a heartbeat for longer than
   * AWARENESS_SOCKET_TIMEOUT_MS, then returns the ids of users who still have
   * at least one socket in the document.
   * @param documentId - the document to read open sockets for
   */
  private async getLiveUserIds(documentId: number): Promise<Set<number>> {
    const key = REDIS_KEYS.awarenessSockets(documentId);
    await this.redisService.zremBelowOrEqual(
      key,
      Date.now() - AWARENESS_SOCKET_TIMEOUT_MS,
    );

    const members = await this.redisService.zmembers(key);
    const userIds = new Set<number>();
    for (const member of members) {
      userIds.add(Number(member.split(':')[0]));
    }
    return userIds;
  }

  /**
   * Builds the awareness-sockets member for a socket. The userId comes first
   * so getLiveUserIds can read it back without another lookup.
   * @param userId - the socket's user
   * @param socketId - the Socket.io socket ID
   */
  private socketMember(userId: number, socketId: string): string {
    return `${userId}:${socketId}`;
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
