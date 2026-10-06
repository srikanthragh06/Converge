import { Kysely, sql } from 'kysely';

/**
 * Creates the agent_conversations table, which anchors each AI agent chat
 * thread to the workspace and user it was started under. workspace_id is
 * fixed at creation time rather than following the user's currently-selected
 * workspace, since it decides which workspace's documents/tools a
 * tool-calling conversation may touch once that lands in a later phase.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('agent_conversations')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('workspace_id', 'integer', (col) =>
      col.notNull().references('workspaces.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex('idx_agent_conversations_workspace_id')
    .on('agent_conversations')
    .column('workspace_id')
    .execute();

  await db.schema
    .createIndex('idx_agent_conversations_user_id')
    .on('agent_conversations')
    .column('user_id')
    .execute();
}

/**
 * Drops the agent_conversations table and its indexes, reversing the up
 * migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('agent_conversations').execute();
}
