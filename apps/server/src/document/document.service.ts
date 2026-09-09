import { createHmac, randomUUID } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetDocumentResponseDto,
  GetDocumentOverviewResponseDto,
  LibraryDocumentDto,
  GetLibraryDocumentsResponseDto,
  GetPinnedDocumentsResponseDto,
  SetDocumentPinnedResponseDto,
  SearchLibraryDocumentsResponseDto,
  type TrashDocumentDto,
  type GetTrashDocumentsResponseDto,
  type GetUploadAuthResponseDto,
  hasWorkspaceRole,
  type ResolvedDocumentAccessLevel,
  type WorkspaceRole,
  hasAccess,
  type DocumentBlock,
  type BlockOperationDto,
} from '@converge/shared';
import { DatabaseService } from '../db/database.service.js';
import { DocumentAccessService } from './document-access.service.js';
import { DocumentYjsService } from './document-yjs.service.js';
import { DocumentCheckpointSchedulerService } from './document-checkpoint-scheduler.service.js';
import { DocumentCheckpointService } from './document-checkpoint.service.js';
import { DocumentIndexingSchedulerService } from './document-indexing-scheduler.service.js';
import {
  markdownFromYDoc,
  blocksFromYDoc,
  applyBlockOperations,
  restoreYDocFromBlocks,
  seedInitialDocumentUpdate,
} from '../utils/editor-schema.js';
import { base64ToUint8Array } from '../utils/utils.js';
import { sql } from 'kysely';
import * as Y from 'yjs';

@Injectable()
export class DocumentService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly documentAccessService: DocumentAccessService,
    private readonly documentYjsService: DocumentYjsService,
    private readonly documentCheckpointSchedulerService: DocumentCheckpointSchedulerService,
    private readonly documentCheckpointService: DocumentCheckpointService,
    private readonly documentIndexingSchedulerService: DocumentIndexingSchedulerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Returns the document with the given ID. Throws NotFoundException if the
   * document does not exist or is deleted, and ForbiddenException if the
   * requesting user has less than viewer access.
   * @param documentId - the ID of the document to fetch
   * @param userId - the ID of the authenticated requesting user
   * @returns the document's id, title, and createdAt
   */
  async getDocumentOfUser(
    documentId: number,
    userId: number,
  ): Promise<GetDocumentResponseDto> {
    const db = this.dbService.kysely;

    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    // Fetch the document fields and its workspace name in a single join.
    const row = await db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .select([
        'd.id',
        'd.title',
        'd.created_at',
        'w.id as workspaceId',
        'w.name as workspaceName',
      ])
      .where('d.id', '=', documentId)
      .where('d.is_deleted', '=', false)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Document not found.');

    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      workspace: { id: row.workspaceId, name: row.workspaceName },
      resolvedAccess: access,
    };
  }

  /**
   * Returns a document's content as Markdown. Throws NotFoundException if the
   * document does not exist, ForbiddenException if the requesting user has
   * less than viewer access. Lossy: block ids, custom props, and any
   * structure Markdown can't express are dropped when converting Blocks to
   * Markdown — read-only, not meant to be diffed back into precise block edits.
   * @param documentId - the document to read
   * @param userId - the ID of the authenticated requesting user
   * @returns the document's content as a Markdown string
   */
  async getDocumentMarkdown(
    documentId: number,
    userId: number,
  ): Promise<string> {
    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    const yDoc = await this.documentYjsService.loadDoc(documentId);
    return markdownFromYDoc(yDoc);
  }

  /**
   * Returns a document's content as BlockNote block JSON, ids and all —
   * the read counterpart used to target block-level writes. Throws
   * NotFoundException if the document does not exist, ForbiddenException
   * if the requesting user has less than viewer access.
   * @param documentId - the document to read
   * @param userId - the ID of the authenticated requesting user
   * @returns the document's content as an array of blocks
   */
  async getDocumentBlocks(
    documentId: number,
    userId: number,
  ): Promise<DocumentBlock[]> {
    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    const yDoc = await this.documentYjsService.loadDoc(documentId);
    return blocksFromYDoc(yDoc);
  }

  /**
   * Applies a batch of id-addressed block edits to a document as a single
   * atomic save, then returns the document's resulting blocks. Throws
   * NotFoundException if the document does not exist, ForbiddenException if
   * the requesting user has less than editor access — matching the check
   * SYNC_DOC_SERVER enforces for a live client edit.
   *
   * Persists and broadcasts the same way a real client's edit does —
   * DocumentYjsService.applyDocUpdate now handles both the Redis publish
   * (for other server instances) and the local room broadcast (for this
   * instance's own connected clients) itself, so there's nothing extra to
   * do here. No socket originates this write, so nothing is excluded from
   * the broadcast — every connected viewer of this document sees it.
   *
   * This is the MCP write path — one of the callers of
   * DocumentYjsService.applyDocUpdate that isn't a live client edit (see
   * also restoreCheckpoint below) — so it takes a synchronous, forced 'mcp'
   * checkpoint immediately beforehand: everything since the last checkpoint
   * is folded in, or, if nothing changed since then, the last checkpoint's
   * content is duplicated into a new row. Either way this guarantees a
   * checkpoint immediately before the agent's change, regardless of the
   * idle/interval scheduler's own timing.
   * @param documentId - the document to edit
   * @param userId - the ID of the authenticated requesting user
   * @param operations - the edits to apply, in order, as one atomic save
   * @returns the document's full block list after applying the edits
   */
  async updateDocumentBlocks(
    documentId: number,
    userId: number,
    operations: BlockOperationDto[],
  ): Promise<DocumentBlock[]> {
    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'editor'))
      throw new ForbiddenException(
        'You must have editor access to edit this document.',
      );

    // Snapshot everything since the last checkpoint before the agent's write
    // lands, so restoring it undoes exactly this call. Forced: an AI edit
    // must always leave a checkpoint immediately before it, even if nothing
    // changed since the previous one (e.g. back-to-back agent edits).
    await this.documentCheckpointService.createCheckpointInternal(
      documentId,
      'mcp',
      true,
    );

    // Compute the edit as Yjs update bytes against a throwaway copy of the
    // document (see applyBlockOperations), then apply it the same way a
    // live client's own edit would be applied.
    const yDoc = await this.documentYjsService.loadDoc(documentId);
    const { update, blocks } = await applyBlockOperations(yDoc, operations);
    await this.documentYjsService.applyDocUpdate(documentId, update);

    // Keep last-edited tracking and automatic checkpoint/indexing
    // scheduling consistent with a real client edit.
    await this.documentYjsService.recordLastEdited(documentId, userId);
    await this.documentCheckpointSchedulerService.onDocumentEdited(documentId);
    await this.documentIndexingSchedulerService.onDocumentEdited(documentId);

    return blocks;
  }

  /**
   * Restores a document's content to a past checkpoint — the MCP-tool
   * equivalent of the live editor's restore action (`editor.replaceBlocks(...)`
   * flowing through the normal sync pipeline). Only restores blocks, not
   * title: a checkpoint's Yjs update never captured title, since title sync
   * is a separate channel (see SyncDocTitleServerSchema in socket/socket.ts).
   * Throws NotFoundException if the document does not exist,
   * ForbiddenException if the requesting user has less than editor access,
   * or whatever getCheckpointContent throws if checkpointId is not a
   * checkpoint on this document.
   * @param documentId - the document to restore
   * @param userId - the requesting user, must have editor+ access
   * @param checkpointId - the checkpoint to restore the document's content to
   * @returns the document's resulting blocks after the restore
   */
  async restoreCheckpoint(
    documentId: number,
    userId: number,
    checkpointId: number,
  ): Promise<DocumentBlock[]> {
    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'editor'))
      throw new ForbiddenException(
        'You must have editor access to restore this document.',
      );

    // Snapshot everything since the last checkpoint before the restore
    // lands, so undoing a bad restore is itself just restoring to this new
    // checkpoint — same safety net updateDocumentBlocks gets. Forced for the
    // same reason: an AI-triggered restore must always leave a checkpoint
    // immediately before it.
    await this.documentCheckpointService.createCheckpointInternal(
      documentId,
      'mcp',
      true,
    );

    // Reconstruct the target checkpoint's content: its stored update is a
    // full self-contained Yjs state, not a delta, so applying it alone to
    // an empty scratch doc fully reconstructs the checkpoint's content.
    const checkpoint =
      await this.documentCheckpointService.getCheckpointContent(
        documentId,
        userId,
        checkpointId,
      );
    const targetScratch = new Y.Doc();
    Y.applyUpdate(targetScratch, base64ToUint8Array(checkpoint.updateBase64));
    const targetBlocks = blocksFromYDoc(targetScratch);

    // Compute the restore as Yjs update bytes against a throwaway copy of
    // the live document (see restoreYDocFromBlocks), then apply it the same
    // way a live client's own restore action would be applied.
    const yDoc = await this.documentYjsService.loadDoc(documentId);
    const { update, blocks } = await restoreYDocFromBlocks(yDoc, targetBlocks);
    await this.documentYjsService.applyDocUpdate(documentId, update);

    // Keep last-edited tracking and automatic checkpoint/indexing
    // scheduling consistent with a real client edit.
    await this.documentYjsService.recordLastEdited(documentId, userId);
    await this.documentCheckpointSchedulerService.onDocumentEdited(documentId);
    await this.documentIndexingSchedulerService.onDocumentEdited(documentId);

    return blocks;
  }

  /**
   * Creates a new document and its initial metadata row in a single transaction,
   * returning the new document's ID. The user must have at least the member role
   * in the target workspace.
   *
   * Also seeds the document's Yjs content with a single empty paragraph
   * block once the transaction has committed — without it, a fresh document
   * has zero blocks, and updateDocumentBlocks's insert/replace operations
   * both require an existing block id to target, leaving no way to add a
   * document's first content. Seeding isn't part of the transaction: it
   * goes through applyDocUpdate, which does its own persistence plus a
   * Redis publish and room broadcast — not something to run inside a DB
   * transaction that might still roll back.
   * @param userId - the ID of the authenticated user who will own the document
   * @param workspaceId - the workspace the document belongs to
   * @param title - optional initial title; defaults to the DB's empty-string
   * default when omitted, matching a document created via the editor UI
   * @returns the newly created document's ID
   */
  async createNewDocument(
    userId: number,
    workspaceId: number,
    title?: string,
  ): Promise<number> {
    const db = this.dbService.kysely;

    // Verify the user is a workspace member (owner, admin, or member).
    const memberRow = await db
      .selectFrom('workspace_members')
      .select('role')
      .where('workspace_id', '=', workspaceId)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (
      !memberRow ||
      !hasWorkspaceRole(memberRow.role as WorkspaceRole, 'member')
    ) {
      throw new ForbiddenException(
        'You must be a member of the workspace to create documents.',
      );
    }

    // Wrap in a transaction so the document and its metadata row are always
    // created together — the metadata seeds the creator's timestamps so the
    // document appears in their library immediately with proper tracking.
    const row = await db.transaction().execute(async (tx) => {
      const documentRow = await tx
        .insertInto('documents')
        .values({
          creator_id: userId,
          workspace_id: workspaceId,
          // title has a DB default (empty string) — only set it when the
          // caller actually provided one, rather than passing an empty
          // string through explicitly.
          ...(title !== undefined ? { title } : {}),
        })
        .returning('documents.id')
        .executeTakeFirst();

      if (!documentRow)
        throw new InternalServerErrorException('Failed to create document.');

      // Initialise metadata so the creator has timestamps from the start.
      await tx
        .insertInto('document_user_metadata')
        .values({ document_id: documentRow.id, user_id: userId })
        .execute();

      return documentRow;
    });

    // Seed the document with one empty block so it isn't left in a state
    // updateDocumentBlocks has no way to add content to — see the doc
    // comment above.
    await this.documentYjsService.applyDocUpdate(
      row.id,
      seedInitialDocumentUpdate(),
    );

    return row.id;
  }

  /**
   * Renames a document. Throws NotFoundException if the document does not
   * exist, ForbiddenException if the requesting user has less than editor
   * access — matching the check SYNC_DOC_TITLE_SERVER enforces for a live
   * client rename. Doesn't schedule a checkpoint: SYNC_DOC_TITLE_SERVER's
   * handler doesn't either, since title isn't part of the Yjs content log
   * checkpoints are built from.
   * @param documentId - the document to rename
   * @param userId - the ID of the authenticated requesting user
   * @param title - the document's new title
   * @returns the document's title after the update
   */
  async updateDocumentTitle(
    documentId: number,
    userId: number,
    title: string,
  ): Promise<string> {
    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'editor'))
      throw new ForbiddenException(
        'You must have editor access to rename this document.',
      );

    // Persists and broadcasts the same way a real client's rename does — no
    // socket originates this write, so nothing is excluded from the
    // broadcast (see applyDocTitleUpdate).
    await this.documentYjsService.applyDocTitleUpdate(documentId, title);
    await this.documentYjsService.recordLastEdited(documentId, userId);

    return title;
  }

  /**
   * Returns overview metadata for the given document: title, creator and owner
   * name and email, and creation date. Throws NotFoundException if the document
   * does not exist or is deleted, and ForbiddenException if the requesting user
   * has less than viewer access.
   * @param documentId - the document to fetch overview data for
   * @param userId - the authenticated user performing the request
   * @returns overview metadata for the document
   */
  async getDocumentOverview(
    documentId: number,
    userId: number,
  ): Promise<GetDocumentOverviewResponseDto> {
    const db = this.dbService.kysely;

    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    // Fetch the document fields needed for the overview response.
    const docRow = await db
      .selectFrom('documents')
      .select(['title', 'creator_id', 'created_at'])
      .where('id', '=', documentId)
      .where('is_deleted', '=', false)
      .executeTakeFirst();

    if (!docRow) throw new NotFoundException('Document not found.');

    // The workspace owner is the effective document owner.
    const workspaceRow = await db
      .selectFrom('documents as d')
      .innerJoin('workspace_members as wm', 'wm.workspace_id', 'd.workspace_id')
      .select(['wm.user_id'])
      .where('d.id', '=', documentId)
      .where('wm.role', '=', 'owner')
      .executeTakeFirst();

    if (!workspaceRow)
      throw new NotFoundException('Workspace owner not found.');

    const ownerRow = await db
      .selectFrom('users')
      .select(['name', 'email'])
      .where('id', '=', workspaceRow.user_id)
      .executeTakeFirst();

    if (!ownerRow) throw new NotFoundException('Owner not found.');

    const creatorRow = await db
      .selectFrom('users')
      .select(['name', 'email'])
      .where('id', '=', docRow.creator_id)
      .executeTakeFirst();

    if (!creatorRow) throw new NotFoundException('Creator not found.');

    return {
      title: docRow.title,
      creatorName: creatorRow.name,
      creatorEmail: creatorRow.email,
      ownerName: ownerRow.name,
      ownerEmail: ownerRow.email,
      createdAt: docRow.created_at,
    };
  }

  /**
   * Soft-deletes the document by setting is_deleted and deleted_at. Throws
   * NotFoundException if the document does not exist or is already deleted, and
   * ForbiddenException if the requesting user has less than admin access.
   * @param documentId - the document to soft-delete
   * @param userId - the authenticated user performing the deletion
   */
  async deleteDocument(documentId: number, userId: number): Promise<void> {
    const db = this.dbService.kysely;

    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'admin'))
      throw new ForbiddenException(
        'You must have admin access to delete this document.',
      );

    // Mark the document as deleted without removing any rows.
    await db
      .updateTable('documents')
      .set({ is_deleted: true, deleted_at: new Date() })
      .where('id', '=', documentId)
      .execute();
  }

  /**
   * Restores a soft-deleted document, reversing deleteDocument. Throws
   * NotFoundException if the document does not exist at all,
   * ForbiddenException if the requesting user has less than admin access,
   * and ConflictException if the document is not currently deleted.
   * @param documentId - the document to restore
   * @param userId - the authenticated user performing the restore
   */
  async restoreDocument(documentId: number, userId: number): Promise<void> {
    const db = this.dbService.kysely;

    // Resolve access including deleted documents — the document being
    // deleted is precisely the case this call needs to see through.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
      true,
    );
    if (!hasAccess(access, 'admin'))
      throw new ForbiddenException(
        'You must have admin access to restore this document.',
      );

    // Clear is_deleted and deleted_at in one conditional update — gating the
    // WHERE on is_deleted = true makes the "already restored" check atomic
    // with the write itself, so two concurrent restores can't both report
    // success.
    const result = await db
      .updateTable('documents')
      .set({ is_deleted: false, deleted_at: null })
      .where('id', '=', documentId)
      .where('is_deleted', '=', true)
      .returning('id')
      .executeTakeFirst();
    if (!result) throw new ConflictException('Document is not deleted.');
  }

  /**
   * Returns a paginated list of soft-deleted documents in the given
   * workspace that the user has admin+ access to, ordered by deleted_at
   * DESC with id DESC as a tiebreaker. Uses keyset pagination via a
   * compound cursor, mirroring getLibraryDocuments. Scoped to admin+
   * because that's also the access level required to restore a document —
   * viewers and editors would see entries they cannot act on.
   * @param userId - the authenticated user whose trash to list
   * @param workspaceId - the workspace to scope the trash to
   * @param limit - maximum number of documents to return
   * @param cursor - compound cursor from the previous page; omit for the first page
   * @returns trashed documents for this page and the nextCursor to fetch the following page
   */
  async getTrashDocuments(
    userId: number,
    workspaceId: number,
    limit: number,
    cursor?: { deletedAt: Date; id: number },
  ): Promise<GetTrashDocumentsResponseDto> {
    const db = this.dbService.kysely;

    // Inner subquery: join all tables and compute the resolved access level,
    // same five-tier CASE as getLibraryDocuments but scoped to deleted docs.
    const inner = db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .leftJoin('workspace_members as wm', (join) =>
        join
          .onRef('wm.workspace_id', '=', 'd.workspace_id')
          .on('wm.user_id', '=', userId),
      )
      .leftJoin('document_access as da', (join) =>
        join.onRef('da.document_id', '=', 'd.id').on('da.user_id', '=', userId),
      )
      .select([
        'd.id',
        'd.title',
        'd.deleted_at as deletedAt',
        sql<ResolvedDocumentAccessLevel>`
          CASE
            WHEN wm.role = 'owner' THEN 'owner'
            WHEN da.access IS NOT NULL THEN da.access
            WHEN wm.role = 'admin' THEN COALESCE(d.admin_doc_access, w.admin_doc_access)
            WHEN wm.role = 'member' THEN COALESCE(d.member_doc_access, w.member_doc_access)
            ELSE COALESCE(d.non_member_doc_access, w.non_member_doc_access)
          END
        `.as('access'),
      ])
      .where('d.is_deleted', '=', true)
      .where('d.workspace_id', '=', workspaceId)
      .as('r');

    // Outer query: filter to admin+, apply ordering and pagination.
    let query = db
      .selectFrom(inner)
      .selectAll()
      .where('r.access', 'in', ['admin', 'owner'])
      .orderBy('r.deletedAt', 'desc')
      .orderBy('r.id', 'desc')
      .limit(limit);

    // Keyset pagination on the (deletedAt, id) compound cursor.
    if (cursor) {
      query = query.where((eb) =>
        eb.or([
          eb('r.deletedAt', '<', cursor.deletedAt),
          eb.and([
            eb('r.deletedAt', '=', cursor.deletedAt),
            eb('r.id', '<', cursor.id),
          ]),
        ]),
      );
    }

    const rows = await query.execute();

    const documents: TrashDocumentDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      deletedAt: row.deletedAt as Date,
    }));

    // nextCursor is null when there are no more results.
    const nextCursor =
      rows.length === limit
        ? {
            deletedAt: rows[rows.length - 1].deletedAt as Date,
            id: rows[rows.length - 1].id,
          }
        : null;

    return { documents, nextCursor };
  }

  /**
   * Returns a paginated list of documents in the given workspace that the user
   * has viewer+ access to, ordered by last_visited_at DESC NULLS LAST with id
   * DESC as a tiebreaker. Uses keyset pagination via a compound cursor.
   *
   * Access is resolved in a subquery CASE expression, then the outer query
   * filters to viewer+ and applies ordering and pagination.
   *
   * @param userId - the authenticated user whose library to list
   * @param workspaceId - the workspace to scope the library to
   * @param limit - maximum number of documents to return
   * @param cursor - compound cursor from the previous page; omit for the first page
   * @param ignorePinnedDocs - when true, excludes documents the user has pinned, so a
   * caller that renders its own separate pinned list (e.g. the sidebar) doesn't have to
   * dedupe client-side. Defaults to false.
   * @returns documents for this page and the nextCursor to fetch the following page
   */
  async getLibraryDocuments(
    userId: number,
    workspaceId: number,
    limit: number,
    cursor?: { lastVisitedAt: Date | null; id: number },
    ignorePinnedDocs = false,
  ): Promise<GetLibraryDocumentsResponseDto> {
    const db = this.dbService.kysely;

    // Inner subquery: join all tables and compute the resolved access level.
    const inner = db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .leftJoin('document_user_metadata as dum', (join) =>
        join
          .onRef('dum.document_id', '=', 'd.id')
          .on('dum.user_id', '=', userId),
      )
      .leftJoin('workspace_members as wm', (join) =>
        join
          .onRef('wm.workspace_id', '=', 'd.workspace_id')
          .on('wm.user_id', '=', userId),
      )
      .leftJoin('document_access as da', (join) =>
        join.onRef('da.document_id', '=', 'd.id').on('da.user_id', '=', userId),
      )
      .select([
        'd.id',
        'd.title',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
        'dum.pinned_at as pinnedAt',
        sql<ResolvedDocumentAccessLevel>`
          CASE
            WHEN wm.role = 'owner' THEN 'owner'
            WHEN da.access IS NOT NULL THEN da.access
            WHEN wm.role = 'admin' THEN COALESCE(d.admin_doc_access, w.admin_doc_access)
            WHEN wm.role = 'member' THEN COALESCE(d.member_doc_access, w.member_doc_access)
            ELSE COALESCE(d.non_member_doc_access, w.non_member_doc_access)
          END
        `.as('access'),
      ])
      .where('d.is_deleted', '=', false)
      .where('d.workspace_id', '=', workspaceId)
      .as('r');

    // Outer query: filter out noAccess, apply ordering and pagination.
    let query = db
      .selectFrom(inner)
      .selectAll()
      .where('r.access', '!=', 'noAccess')
      .orderBy(sql`"r"."lastVisitedAt" DESC NULLS LAST`)
      .orderBy(sql`"r"."id" DESC`)
      .limit(limit);

    // Excludes pinned documents so a caller with its own pinned-documents list
    // (the sidebar) never has to dedupe the two lists client-side.
    if (ignorePinnedDocs) {
      query = query.where('r.pinnedAt', 'is', null);
    }

    // Keyset pagination — handles transition into the NULL lastVisitedAt section.
    if (cursor) {
      query =
        cursor.lastVisitedAt !== null
          ? query.where((eb) =>
              eb.or([
                eb('r.lastVisitedAt', '<', cursor.lastVisitedAt),
                eb.and([
                  eb('r.lastVisitedAt', '=', cursor.lastVisitedAt),
                  eb('r.id', '<', cursor.id),
                ]),
                eb('r.lastVisitedAt', 'is', null),
              ]),
            )
          : query.where('r.id', '<', cursor.id);
    }

    const rows = await query.execute();

    const documents: LibraryDocumentDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      access: row.access,
      lastVisitedAt: row.lastVisitedAt,
      lastEditedAt: row.lastEditedAt,
    }));

    // nextCursor is null when there are no more results.
    const nextCursor =
      rows.length === limit
        ? {
            lastVisitedAt: rows[rows.length - 1].lastVisitedAt,
            id: rows[rows.length - 1].id,
          }
        : null;

    return { documents, nextCursor };
  }

  /**
   * Returns every document in the given workspace that the user has pinned
   * and still has viewer+ access to, ordered by pinned_at DESC (most recently
   * pinned first). Uses the same access-resolution subquery as
   * getLibraryDocuments. Unpaginated — a user's pinned list is expected to
   * stay small.
   * @param userId - the authenticated user whose pinned documents to list
   * @param workspaceId - the workspace to scope the list to
   * @returns the user's pinned documents in this workspace
   */
  async getPinnedDocuments(
    userId: number,
    workspaceId: number,
  ): Promise<GetPinnedDocumentsResponseDto> {
    const db = this.dbService.kysely;

    // Inner subquery: same five-tier access resolution as getLibraryDocuments.
    const inner = db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .leftJoin('document_user_metadata as dum', (join) =>
        join
          .onRef('dum.document_id', '=', 'd.id')
          .on('dum.user_id', '=', userId),
      )
      .leftJoin('workspace_members as wm', (join) =>
        join
          .onRef('wm.workspace_id', '=', 'd.workspace_id')
          .on('wm.user_id', '=', userId),
      )
      .leftJoin('document_access as da', (join) =>
        join.onRef('da.document_id', '=', 'd.id').on('da.user_id', '=', userId),
      )
      .select([
        'd.id',
        'd.title',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
        'dum.pinned_at as pinnedAt',
        sql<ResolvedDocumentAccessLevel>`
          CASE
            WHEN wm.role = 'owner' THEN 'owner'
            WHEN da.access IS NOT NULL THEN da.access
            WHEN wm.role = 'admin' THEN COALESCE(d.admin_doc_access, w.admin_doc_access)
            WHEN wm.role = 'member' THEN COALESCE(d.member_doc_access, w.member_doc_access)
            ELSE COALESCE(d.non_member_doc_access, w.non_member_doc_access)
          END
        `.as('access'),
      ])
      .where('d.is_deleted', '=', false)
      .where('d.workspace_id', '=', workspaceId)
      .as('r');

    // Outer query: filter to pinned + viewer+ access, order by most recently pinned.
    const rows = await db
      .selectFrom(inner)
      .selectAll()
      .where('r.pinnedAt', 'is not', null)
      .where('r.access', '!=', 'noAccess')
      .orderBy('r.pinnedAt', 'desc')
      .execute();

    const documents: LibraryDocumentDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      access: row.access,
      lastVisitedAt: row.lastVisitedAt,
      lastEditedAt: row.lastEditedAt,
    }));

    return { documents };
  }

  /**
   * Pins or unpins the given document for the given user. Throws 404 if the
   * document does not exist or is deleted, and 403 if the user has less than
   * viewer access — pinning is a personal bookmark, so it requires no more
   * access than appearing in the library already does.
   * @param documentId - the document to pin or unpin
   * @param userId - the authenticated user pinning or unpinning it
   * @param pinned - true to pin, false to unpin
   * @returns the resulting pinnedAt value — a timestamp when pinned, null when unpinned
   */
  async setPinned(
    documentId: number,
    userId: number,
    pinned: boolean,
  ): Promise<SetDocumentPinnedResponseDto> {
    const db = this.dbService.kysely;

    // Resolve access — throws NotFoundException if the document does not exist.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    // Upsert so pinning a never-before-visited document doesn't need a
    // pre-existing document_user_metadata row. Uses the DB's own clock (not
    // app-server time) for consistency with recordLastVisited/recordLastEdited,
    // and returns the persisted value rather than re-deriving it client-side.
    const pinnedAtValue = pinned ? sql<Date>`now()` : null;
    const row = await db
      .insertInto('document_user_metadata')
      .values({
        document_id: documentId,
        user_id: userId,
        pinned_at: pinnedAtValue,
      })
      .onConflict((oc) =>
        oc
          .columns(['document_id', 'user_id'])
          .doUpdateSet({ pinned_at: pinnedAtValue }),
      )
      .returning('pinned_at as pinnedAt')
      .executeTakeFirstOrThrow();

    return { pinnedAt: row.pinnedAt };
  }

  /**
   * Searches documents in the given workspace the user has viewer+ access to,
   * matching by title using trigram similarity. Empty-title documents are
   * excluded. Uses the same subquery access-resolution pattern as
   * getLibraryDocuments.
   * @param userId - the authenticated user whose library to search
   * @param workspaceId - the workspace to scope the search to
   * @param title - the search query to match against document titles
   * @param limit - maximum number of results to return
   * @returns matching documents ordered by similarity score descending
   */
  async searchLibraryDocuments(
    userId: number,
    workspaceId: number,
    title: string,
    limit: number,
  ): Promise<SearchLibraryDocumentsResponseDto> {
    const db = this.dbService.kysely;

    // Inner subquery: same five-tier resolution as getLibraryDocuments.
    const inner = db
      .selectFrom('documents as d')
      .innerJoin('workspaces as w', 'w.id', 'd.workspace_id')
      .leftJoin('document_user_metadata as dum', (join) =>
        join
          .onRef('dum.document_id', '=', 'd.id')
          .on('dum.user_id', '=', userId),
      )
      .leftJoin('workspace_members as wm', (join) =>
        join
          .onRef('wm.workspace_id', '=', 'd.workspace_id')
          .on('wm.user_id', '=', userId),
      )
      .leftJoin('document_access as da', (join) =>
        join.onRef('da.document_id', '=', 'd.id').on('da.user_id', '=', userId),
      )
      .select([
        'd.id',
        'd.title',
        'dum.last_visited_at as lastVisitedAt',
        'dum.last_edited_at as lastEditedAt',
        sql<ResolvedDocumentAccessLevel>`
          CASE
            WHEN wm.role = 'owner' THEN 'owner'
            WHEN da.access IS NOT NULL THEN da.access
            WHEN wm.role = 'admin' THEN COALESCE(d.admin_doc_access, w.admin_doc_access)
            WHEN wm.role = 'member' THEN COALESCE(d.member_doc_access, w.member_doc_access)
            ELSE COALESCE(d.non_member_doc_access, w.non_member_doc_access)
          END
        `.as('access'),
        sql<number>`similarity(d.title, ${title})`.as('score'),
      ])
      .where('d.is_deleted', '=', false)
      .where('d.workspace_id', '=', workspaceId)
      .where('d.title', '!=', '')
      .as('r');

    // Outer query: filter out noAccess and order by similarity.
    const rows = await db
      .selectFrom(inner)
      .selectAll()
      .where('r.access', '!=', 'noAccess')
      .orderBy('r.score', 'desc')
      .limit(limit)
      .execute();

    const documents: LibraryDocumentDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      access: row.access,
      lastVisitedAt: row.lastVisitedAt,
      lastEditedAt: row.lastEditedAt,
    }));

    return { documents };
  }

  /**
   * Generates a one-time ImageKit upload auth payload for client-side uploads.
   * The private key signs the token+expire pair so ImageKit can verify the
   * request without the private key ever leaving the server.
   * @returns token, expire (Unix seconds), and HMAC-SHA1 signature
   */
  getImageKitUploadAuth(): GetUploadAuthResponseDto {
    const privateKey = this.configService.get<string>('IMAGEKIT_PRIVATE_KEY');
    if (!privateKey)
      throw new InternalServerErrorException(
        'ImageKit private key is not configured.',
      );

    // A unique token per request prevents replay attacks — ImageKit rejects reused tokens.
    const token = randomUUID();

    // Expire 5 minutes from now; must be within 1 hour per ImageKit's requirement.
    const expire = Math.floor(Date.now() / 1000) + 300;

    // HMAC-SHA1 of token+expire proves this payload was issued by our server.
    const signature = createHmac('sha1', privateKey)
      .update(token + expire)
      .digest('hex');

    return { token, expire, signature };
  }
}
