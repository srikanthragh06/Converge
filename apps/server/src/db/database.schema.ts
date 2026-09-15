import {
  AgentMessageRole,
  CheckpointSource,
  DocumentAccessLevel,
  DocumentIndexingStatus,
  WorkspaceRole,
  WorkspaceType,
} from '@converge/shared';
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
  /** True if this row is a merged version-history checkpoint rather than a single unfolded edit. */
  is_checkpoint: Generated<boolean>;
  /** What triggered this checkpoint row; NULL for non-checkpoint rows. */
  checkpoint_source: CheckpointSource | null;
  /** Timestamp of the most recent edit folded into this checkpoint; NULL for non-checkpoint rows. */
  content_last_edited_at: Date | null;
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
  /** FK to workspaces.id — the workspace this document belongs to. */
  workspace_id: number;
  /** Overrides workspace.admin_doc_access for this document; NULL means inherit. */
  admin_doc_access: DocumentAccessLevel | null;
  /** Overrides workspace.member_doc_access for this document; NULL means inherit. */
  member_doc_access: DocumentAccessLevel | null;
  /** Overrides workspace.non_member_doc_access for this document; NULL means inherit. */
  non_member_doc_access: DocumentAccessLevel | null;
  created_at: Generated<Date>;
  /** RAG indexing lifecycle state — see DocumentIndexingStatus. Defaults to 'idle'. */
  indexing_status: Generated<DocumentIndexingStatus>;
  /** When this document's content was last confirmed indexed by a successful reindex run. NULL if never indexed. */
  last_indexed_at: Date | null;
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
  /** FK to workspaces.id — the user's currently selected workspace. */
  current_workspace_id: number | null;
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
  /** Timestamp of when this user pinned the document; null if not pinned. */
  pinned_at: Date | null;
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

/** Row shape for the workspaces table. */
export interface WorkspacesTable {
  id: Generated<number>;
  name: string;
  /** FK to users.id — the workspace owner, who is also doc owner for all docs in this workspace. */
  owner_id: number;
  type: WorkspaceType;
  /** Default doc access for workspace admins. */
  admin_doc_access: Generated<DocumentAccessLevel>;
  /** Default doc access for workspace members. */
  member_doc_access: Generated<DocumentAccessLevel>;
  /** Default doc access for users not in this workspace. */
  non_member_doc_access: Generated<DocumentAccessLevel>;
  created_at: Generated<Date>;
}

/** Row shape for the document_checkpoint_contributors table. */
export interface DocumentCheckpointContributorsTable {
  /** FK to document_updates.id — scopes this row to a specific checkpoint row. */
  update_id: number;
  /** FK to users.id — a user who edited the document leading up to this checkpoint. */
  user_id: number;
}

/** Row shape for the api_keys table. */
export interface ApiKeysTable {
  id: Generated<number>;
  /** FK to users.id — whose permissions this key inherits. */
  user_id: number;
  /** SHA-256 hash of the raw key. The raw key itself is never stored. */
  key_hash: string;
  /** First few characters of the raw key, shown in listings so a user can
   * identify which key is which without ever re-displaying the secret. */
  key_prefix: string;
  /** User-chosen name, e.g. "Claude Code - laptop". */
  label: string;
  last_used_at: Date | null;
  /** Soft revoke — a revoked key stays visible in history but fails auth. */
  revoked_at: Date | null;
  created_at: Generated<Date>;
}

/**
 * Row shape for the document_chunks table.
 * `embedding` is a pgvector column; Kysely has no native vector type, so it
 * round-trips as the string pgvector itself uses (e.g. "[0.1,0.2,...]") on
 * both read and write — callers must format/parse it themselves.
 */
export interface DocumentChunksTable {
  id: Generated<number>;
  /** FK to documents.id — the document this chunk was extracted from. */
  document_id: number;
  /** Denormalized from documents.workspace_id — lets retrieval filter by access without a join. */
  workspace_id: number;
  /** BlockNote block ids (UUID strings) this chunk spans, in document order. */
  block_ids: string[];
  /** The chunk's text, as Markdown — what gets embedded and what's shown as a citation excerpt. */
  content: string;
  /** pgvector embedding, 1536 dimensions (text-embedding-3-small). */
  embedding: string;
  /** Token count of `content`, via the same tokenizer used for chunk sizing — backs document_chunk_corpus_stats' average-length stat and BM25's length normalization. */
  token_count: number;
  /** GENERATED ALWAYS AS (to_tsvector('english', content)) STORED — Postgres maintains this automatically; no insert ever provides a value. Kysely has no tsvector type, so this round-trips as the driver's raw text representation, same wrinkle as `embedding`. */
  content_tsv: Generated<string>;
  created_at: Generated<Date>;
}

/** Row shape for the document_chunk_term_stats table — per-workspace, per-term document frequency (how many chunks contain this term), the IDF ingredient tsvector/GIN alone can't provide. Incrementally maintained by DocumentIndexingService; absence of a row means zero. */
export interface DocumentChunkTermStatsTable {
  /** FK to workspaces.id — BM25 stats are scoped per workspace, matching retrieval's access-filtered scope. */
  workspace_id: number;
  /** A single Postgres-stemmed lexeme, as produced by to_tsvector('english', ...) — matches document_chunks.content_tsv's tokenization exactly. */
  term: string;
  /** Number of chunks in this workspace whose content_tsv contains this term. */
  document_frequency: Generated<number>;
}

/** Row shape for the document_chunk_corpus_stats table — one row per workspace, tracking the running totals behind average chunk length (total_tokens / total_chunks), BM25's other corpus-wide ingredient. */
export interface DocumentChunkCorpusStatsTable {
  /** FK to workspaces.id, and this table's primary key — one row per workspace. */
  workspace_id: number;
  /** Total number of chunks currently indexed in this workspace. */
  total_chunks: Generated<number>;
  /** Sum of token_count across every chunk currently indexed in this workspace. */
  total_tokens: Generated<number>;
}

/** Row shape for the document_block_hashes table — per-block content fingerprints used to detect changed/added/deleted blocks between indexing runs. */
export interface DocumentBlockHashesTable {
  /** FK to documents.id — scopes this row to a specific document. */
  document_id: number;
  /** BlockNote block id (UUID string) this fingerprint belongs to. */
  block_id: string;
  /** Content hash of the block's Markdown as of the last indexing run. */
  hash: string;
  updated_at: Generated<Date>;
}

/** Row shape for the workspace_members table. */
export interface WorkspaceMembersTable {
  /** FK to workspaces.id — scopes this membership to a specific workspace. */
  workspace_id: number;
  /** FK to users.id — the user who is a member of the workspace. */
  user_id: number;
  /** Role the user holds within this workspace. */
  role: WorkspaceRole;
  /** Set on every workspace switch; used for recency-based sorting. */
  last_visited_at: Date | null;
  created_at: Generated<Date>;
}

/** Row shape for the agent_conversations table. */
export interface AgentConversationsTable {
  id: Generated<number>;
  /** FK to workspaces.id — fixed at creation time; decides which workspace's tools/documents this conversation can touch. */
  workspace_id: number;
  /** FK to users.id — the user this conversation belongs to. Conversations are not shared across users. */
  user_id: number;
  /** The OpenAI Responses API response.id from this conversation's most recently completed step, passed back as previous_response_id so OpenAI's own backend supplies prior context. Null until the first step completes. */
  last_response_id: string | null;
  created_at: Generated<Date>;
  /** Bumped alongside last_response_id after every completed step — tracks actual activity, not just creation time. listConversations orders by this so a caller resumes the conversation they last used, not just the one created most recently. */
  updated_at: Generated<Date>;
  /** User-set display name. Null means untitled — the frontend falls back to a formatted creation date. */
  title: string | null;
}

/**
 * Row shape for the agent_messages table — one row per step's worth of
 * OpenAI Responses API output (not one row per turn), so a step with a
 * tool call persists as two rows ('assistant' with that step's raw
 * response.output array, 'tool' with the function_call_output items sent
 * back) rather than bundling both onto a single row. Purely a
 * display/audit log now — a model call is driven by
 * agent_conversations.last_response_id (previous_response_id chaining),
 * not by reading this table back; see AgentService's class doc comment.
 */
export interface AgentMessagesTable {
  id: Generated<number>;
  /** FK to agent_conversations.id — scopes this message to a specific conversation. */
  conversation_id: number;
  /** Who authored this message. */
  role: AgentMessageRole;
  /**
   * JSON.stringify of this row's payload — the plain text string for a
   * 'user' row, a step's raw response.output item array for 'assistant',
   * or that step's function_call_output item array for 'tool'. Not parsed
   * back into any request shape (see the interface doc comment) — kept as
   * an opaque string for the same "no re-derivation, store what was
   * actually produced" reason as before.
   */
  content: string;
  /** Which step within a turn produced this message. Multiple rows can share a step_index (an assistant tool-call row and its paired tool-result row). */
  step_index: Generated<number>;
  created_at: Generated<Date>;
}

// Root schema passed as a generic to Kysely<DatabaseSchema>.
// Table names must exactly match the Postgres table names.
export interface DatabaseSchema {
  agent_conversations: AgentConversationsTable;
  agent_messages: AgentMessagesTable;
  api_keys: ApiKeysTable;
  document_access: DocumentAccessTable;
  document_block_hashes: DocumentBlockHashesTable;
  document_checkpoint_contributors: DocumentCheckpointContributorsTable;
  document_chunks: DocumentChunksTable;
  document_chunk_corpus_stats: DocumentChunkCorpusStatsTable;
  document_chunk_term_stats: DocumentChunkTermStatsTable;
  document_updates: DocumentUpdatesTable;
  document_user_metadata: DocumentUserMetadataTable;
  documents: DocumentsTable;
  users: UsersTable;
  workspace_members: WorkspaceMembersTable;
  workspaces: WorkspacesTable;
}
