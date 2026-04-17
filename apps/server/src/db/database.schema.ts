import { Generated } from 'kysely';

/**
 * Row shape for the document_updates table.
 * BYTEA columns deserialise to Buffer via the pg driver.
 */
export interface DocumentUpdatesTable {
  id: Generated<number>;
  /** FK to documents.id — scopes this update row to a specific document. */
  document_id: number;
  /** Raw Yjs update binary, stored as BYTEA and deserialised to Buffer by pg. */
  update: Buffer;
  created_at: Generated<Date>;
}

/** Row shape for the documents table. */
export interface DocumentsTable {
  id: Generated<number>;
  /** FK to users.id — the user who created this document. */
  creator_id: number;
  /** Monotonically incrementing counter, increased on every persisted Yjs update. */
  update_count: Generated<number>;
  /** Value of update_count at the time of the last compaction. */
  last_compact_count: Generated<number>;
  created_at: Generated<Date>;
}

/** Row shape for the users table. */
export interface UsersTable {
  id: Generated<number>;
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
