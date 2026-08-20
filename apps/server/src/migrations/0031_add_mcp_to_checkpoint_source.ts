import { Kysely, sql } from 'kysely';

/**
 * Widens document_updates.checkpoint_source's CHECK constraint to allow
 * 'mcp' — a safety checkpoint taken right before an MCP tool call writes to
 * a document's content, so a human can always undo an agent's edit. Unlike
 * 'manual'/'idle'/'interval', which are all human- or timer-driven, 'mcp'
 * fires synchronously from updateDocumentBlocks itself rather than the
 * checkpoint scheduler.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE document_updates
    DROP CONSTRAINT document_updates_checkpoint_source_check
  `.execute(db);
  await sql`
    ALTER TABLE document_updates
    ADD CONSTRAINT document_updates_checkpoint_source_check
    CHECK (checkpoint_source IS NULL OR checkpoint_source IN ('manual', 'idle', 'interval', 'mcp'))
  `.execute(db);
}

/**
 * Restores the original three-value CHECK constraint, reversing the up
 * migration. Any 'mcp' rows already present would violate it — not a
 * concern in practice since down migrations only run in development.
 *
 * @param db - The Kysely instance provided by the migrator.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE document_updates
    DROP CONSTRAINT document_updates_checkpoint_source_check
  `.execute(db);
  await sql`
    ALTER TABLE document_updates
    ADD CONSTRAINT document_updates_checkpoint_source_check
    CHECK (checkpoint_source IS NULL OR checkpoint_source IN ('manual', 'idle', 'interval'))
  `.execute(db);
}
