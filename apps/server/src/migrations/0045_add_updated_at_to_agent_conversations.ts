import { Kysely, sql } from 'kysely';

/**
 * Adds updated_at to agent_conversations, defaulting to now() so it starts
 * equal to created_at for a freshly-created row. Bumped by sendMessage
 * alongside last_response_id after every completed step, so it tracks
 * actual conversation activity rather than just creation time —
 * listConversations orders by this (not created_at) to resume the
 * conversation a caller actually last used, since created_at alone can't
 * distinguish that from one that was merely created more recently (e.g. two
 * concurrent tabs racing to create a conversation for the same workspace).
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_conversations')
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

/**
 * Drops updated_at, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_conversations')
    .dropColumn('updated_at')
    .execute();
}
