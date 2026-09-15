import { Kysely } from 'kysely';

/**
 * Adds a nullable title to agent_conversations. Null means "untitled" — the
 * frontend falls back to the conversation's formatted creation date, the
 * same label it already used before this column existed. No default/backfill
 * needed since every existing row already renders correctly under that
 * fallback.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_conversations')
    .addColumn('title', 'text')
    .execute();
}

/**
 * Drops title, reversing the up migration.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('agent_conversations')
    .dropColumn('title')
    .execute();
}
