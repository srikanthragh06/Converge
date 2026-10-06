import { Kysely, sql } from 'kysely';

/**
 * Adds tool-calling columns to agent_messages: tool_calls/tool_results
 * (nullable jsonb, populated only on a turn where the model called a tool)
 * and step_index (defaults to 0 until a later phase's multi-step loop
 * assigns higher values). role's check constraint is unchanged — a turn
 * with tool calls is still persisted as a single 'assistant' row, not a
 * separate 'tool' role, per the original agent_messages design (see
 * 0041_create_agent_messages.ts).
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_messages')
    .addColumn('tool_calls', 'jsonb')
    .addColumn('tool_results', 'jsonb')
    .addColumn('step_index', 'integer', (col) => col.notNull().defaultTo(0))
    .execute();
}

/**
 * Drops the columns added by the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_messages')
    .dropColumn('tool_calls')
    .dropColumn('tool_results')
    .dropColumn('step_index')
    .execute();
}
