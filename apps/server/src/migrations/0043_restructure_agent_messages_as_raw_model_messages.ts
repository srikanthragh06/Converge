import { Kysely, sql } from 'kysely';

/**
 * Restructures agent_messages to store one row per AI SDK ModelMessage
 * instead of one row per turn with tool_calls/tool_results bundled onto a
 * single 'assistant' row. content stays text (always a JSON-stringified
 * ModelMessage.content — a quoted string for 'user', or a serialized array
 * of parts for 'assistant'/'tool' — parsed back explicitly by the app
 * rather than relying on Postgres to auto-parse a jsonb column), role's
 * check constraint widens to allow 'tool', and tool_calls/tool_results are
 * dropped since a tool call and its result are now just two separate rows,
 * matching what the model actually sees, instead of two columns bundled
 * onto one row.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_messages')
    .dropConstraint('agent_messages_role_check')
    .execute();

  await db.schema
    .alterTable('agent_messages')
    .addCheckConstraint(
      'agent_messages_role_check',
      sql`role IN ('user', 'assistant', 'tool')`,
    )
    .execute();

  await db.schema
    .alterTable('agent_messages')
    .dropColumn('tool_calls')
    .dropColumn('tool_results')
    .execute();
}

/**
 * Reverses the up migration: restores tool_calls/tool_results and narrows
 * role's check constraint back to ('user', 'assistant').
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_messages')
    .addColumn('tool_calls', 'jsonb')
    .addColumn('tool_results', 'jsonb')
    .execute();

  await db.schema
    .alterTable('agent_messages')
    .dropConstraint('agent_messages_role_check')
    .execute();

  await db.schema
    .alterTable('agent_messages')
    .addCheckConstraint(
      'agent_messages_role_check',
      sql`role IN ('user', 'assistant')`,
    )
    .execute();
}
