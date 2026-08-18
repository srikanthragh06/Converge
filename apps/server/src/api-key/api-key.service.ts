import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { DatabaseService } from '../db/database.service';
import { type ApiKeyDto, type CreateApiKeyResponseDto } from '@converge/shared';

// Prefix on every generated key so a leaked secret is recognisable as a
// Converge API key at a glance, same convention as "sk-" or "ghp_".
const KEY_PREFIX = 'conv_';
// Length of the prefix shown back to the user in listings, including
// KEY_PREFIX, so they can tell keys apart without re-displaying the secret.
const DISPLAY_PREFIX_LENGTH = 12;

@Injectable()
export class ApiKeyService {
  constructor(private readonly dbService: DatabaseService) {} // Persists and validates hashed API keys.

  /**
   * Generates a new API key for the given user, storing only its hash.
   * The raw key is returned once and is never recoverable afterwards.
   * @param userId - the owning user's numeric database ID
   * @param label - a user-chosen name for the key, e.g. "Claude Code - laptop"
   * @returns the raw key (shown once) plus the created row's metadata
   */
  async createApiKey(
    userId: number,
    label: string,
  ): Promise<CreateApiKeyResponseDto> {
    const rawKey = `${KEY_PREFIX}${randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, DISPLAY_PREFIX_LENGTH);

    const row = await this.dbService.kysely
      .insertInto('api_keys')
      .values({ user_id: userId, key_hash: keyHash, key_prefix: keyPrefix, label })
      .returning(['id', 'label', 'key_prefix', 'created_at'])
      .executeTakeFirstOrThrow();

    return {
      id: row.id,
      label: row.label,
      keyPrefix: row.key_prefix,
      rawKey,
      createdAt: row.created_at,
    };
  }

  /**
   * Lists all API keys belonging to a user, newest first. Never includes the
   * raw key or its hash — only display-safe metadata.
   * @param userId - the owning user's numeric database ID
   */
  async listApiKeys(userId: number): Promise<ApiKeyDto[]> {
    const rows = await this.dbService.kysely
      .selectFrom('api_keys')
      .select(['id', 'label', 'key_prefix', 'last_used_at', 'revoked_at', 'created_at'])
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      keyPrefix: row.key_prefix,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Soft-revokes a key so it stays visible in history but fails future auth
   * checks. Scoped to the requesting user so one user cannot revoke another
   * user's key by guessing its ID.
   * @param userId - the requesting user's numeric database ID
   * @param keyId - the API key row's ID to revoke
   */
  async revokeApiKey(userId: number, keyId: number): Promise<void> {
    await this.dbService.kysely
      .updateTable('api_keys')
      .set({ revoked_at: new Date() })
      .where('id', '=', keyId)
      .where('user_id', '=', userId)
      .execute();
  }

  /**
   * Validates a raw API key presented on an incoming request and resolves it
   * to the owning user's ID. Fire-and-forgets a last_used_at update so a slow
   * write never blocks the caller's actual request.
   * Throws UnauthorizedException on any invalid, unknown, or revoked key.
   * @param rawKey - the raw key string from the Authorization header
   * @returns the owning user's numeric database ID
   */
  async validateApiKey(rawKey: string): Promise<number> {
    const keyHash = this.hashKey(rawKey);

    const row = await this.dbService.kysely
      .selectFrom('api_keys')
      .select(['id', 'user_id'])
      .where('key_hash', '=', keyHash)
      .where('revoked_at', 'is', null)
      .executeTakeFirst();

    if (!row) throw new UnauthorizedException('Invalid or revoked API key.');

    this.dbService.kysely
      .updateTable('api_keys')
      .set({ last_used_at: new Date() })
      .where('id', '=', row.id)
      .execute()
      .catch((err) => console.error('Failed to update api_keys.last_used_at', err));

    return row.user_id;
  }

  /**
   * Hashes a raw key with SHA-256. Plain (fast) hashing is intentional here
   * rather than bcrypt/argon2 — those defend against brute-forcing
   * low-entropy, human-chosen secrets like passwords, but a 32-byte random
   * key already has effectively uncrackable entropy on its own.
   * @param rawKey - the raw key string to hash
   */
  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}
