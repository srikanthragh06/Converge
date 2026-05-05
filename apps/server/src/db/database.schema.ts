import { DocumentAccessLevel } from '@converge/shared';
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
  /** Document title, editable by the owner. Defaults to empty string. */
  title: Generated<string>;
  /** True once the owner has soft-deleted the document; filters it from all read queries. */
  is_deleted: Generated<boolean>;
  /** Timestamp set alongside is_deleted for audit and future trash-expiry logic. Null until deleted. */
  deleted_at: Date | null;
  /** FK to users.id — current owner of the document. Starts as creator_id, can be transferred. */
  owner_id: number;
  /** Monotonically incrementing counter, increased on every persisted Yjs update. */
  update_count: Generated<number>;
  /** Value of update_count at the time of the last compaction. */
  last_compact_count: Generated<number>;
  /** Fallback access level for users with no explicit row in document_access. Defaults to 'noAccess'. */
  default_access: Generated<DocumentAccessLevel>;
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

/** Row shape for the document_user_metadata table. */
export interface DocumentUserMetadataTable {
  /** FK to documents.id — scopes this row to a specific document. */
  document_id: number;
  /** FK to users.id — scopes this row to a specific user. */
  user_id: number;
  /** Timestamp of the last time this user opened the document (set on WebSocket connect). */
  last_visited_at: Generated<Date>;
  /** Timestamp of the last time this user pushed a content or title update. */
  last_edited_at: Generated<Date>;
}

/** Row shape for the document_access table. */
export interface DocumentAccessTable {
  /** FK to documents.id — scopes this access record to a specific document. */
  document_id: number;
  /** FK to users.id — the user this access level applies to. */
  user_id: number;
  /** Access level granted to this user for this document. */
  access: DocumentAccessLevel;
  created_at: Generated<Date>;
}

// Root schema passed as a generic to Kysely<DatabaseSchema>.
// Table names must exactly match the Postgres table names.
export interface DatabaseSchema {
  document_access: DocumentAccessTable;
  document_updates: DocumentUpdatesTable;
  document_user_metadata: DocumentUserMetadataTable;
  documents: DocumentsTable;
  users: UsersTable;
}
