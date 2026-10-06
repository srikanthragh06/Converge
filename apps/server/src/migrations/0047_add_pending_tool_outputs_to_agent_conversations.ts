import { Kysely } from 'kysely';

/**
 * Adds pending_tool_outputs to agent_conversations: the tool results the
 * conversation's last_response_id is still owed, sent ahead of the next
 * message so a turn interrupted between a tool-calling response and the
 * call carrying its results no longer leaves the conversation rejected by
 * OpenAI ("No tool output found for function call"). Nullable with no
 * backfill — null means nothing is owed, true of every row that finished
 * its last turn normally.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_conversations')
    .addColumn('pending_tool_outputs', 'jsonb')
    .execute();
}

/**
 * Drops pending_tool_outputs, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_conversations')
    .dropColumn('pending_tool_outputs')
    .execute();
}
