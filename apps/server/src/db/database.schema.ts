// Row shape for the document_updates table.
// BYTEA columns deserialise to Buffer via the pg driver.

import { Generated } from 'kysely';

export interface DocumentUpdatesTable {
  id: Generated<bigint>;
  update: Buffer;
  created_at: Generated<Date>;
}

// Root schema passed as a generic to Kysely<DatabaseSchema>.
// Table names must exactly match the Postgres table names.
export interface DatabaseSchema {
  document_updates: DocumentUpdatesTable;
}
