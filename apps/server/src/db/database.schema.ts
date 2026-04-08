import { Generated } from 'kysely';

/**
 * Row shape for the document_updates table.
 * BYTEA columns deserialise to Buffer via the pg driver.
 */
export interface DocumentUpdatesTable {
  id: Generated<bigint>;
  /** Raw Yjs update binary, stored as BYTEA and deserialised to Buffer by pg. */
  update: Buffer;
  created_at: Generated<Date>;
}

/** Row shape for the documents table. */
export interface DocumentsTable {
  id: Generated<bigint>;
  /** Monotonically incrementing counter, increased on every persisted Yjs update. */
  update_count: Generated<number>;
  /** Value of update_count at the time of the last compaction. */
  last_compact_count: Generated<number>;
  created_at: Generated<Date>;
}

/** Row shape for the users table. */
export interface UsersTable {
  id: Generated<bigint>;
  /** Stable Google user identifier from the `sub` claim of the ID token. */
  google_id: string;
  email: string;
  name: string;
  /** Profile picture URL provided by Google. Null if not available. */
  avatar_url: string | null;
  created_at: Generated<Date>;
}

// Root schema passed as a generic to Kysely<DatabaseSchema>.
// Table names must exactly match the Postgres table names.
export interface DatabaseSchema {
  document_updates: DocumentUpdatesTable;
  documents: DocumentsTable;
  users: UsersTable;
}
