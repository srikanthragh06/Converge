import { Kysely } from 'kysely';

/**
 * Adds last_response_id to agent_conversations — the OpenAI Responses API's
 * own response.id from the most recently completed step of this
 * conversation. Passed back as previous_response_id on the next call so
 * OpenAI's own backend supplies prior turns' context (including reasoning
 * items) automatically, rather than this app reconstructing a full
 * ChatCompletionMessageParam-style history itself on every call — the
 * reconstruction approach the Vercel AI SDK migration replaced, after
 * root-causing a reproducible crash to that reconstruction path. Nullable:
 * a conversation with no completed turn yet has no previous response to
 * chain from.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_conversations')
    .addColumn('last_response_id', 'text')
    .execute();
}

/**
 * Drops last_response_id, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_conversations')
    .dropColumn('last_response_id')
    .execute();
}
