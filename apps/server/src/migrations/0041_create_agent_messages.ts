import { Kysely, sql } from 'kysely';

/**
 * Creates the agent_messages table — the append-log of a conversation's turns,
 * same shape as document_updates. role is currently limited to 'user' and
 * 'assistant' since this phase has no tool-calling yet; the check constraint
 * widens (and tool_calls/tool_results columns get added) once a later phase
 * introduces tool use, rather than reserving space for it now.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('agent_messages')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('conversation_id', 'bigint', (col) =>
      col.notNull().references('agent_conversations.id').onDelete('cascade'),
    )
    .addColumn('role', 'text', (col) =>
      col.notNull().check(sql`role IN ('user', 'assistant')`),
    )
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_agent_messages_conversation_id')
    .on('agent_messages')
    .column('conversation_id')
    .execute();
}

/**
 * Drops the agent_messages table and its index, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('agent_messages').execute();
}
