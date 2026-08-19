import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as Y from 'yjs';
import {
  hasAccess,
  type CheckpointSource,
  type GetDocumentCheckpointsResponseDto,
  type GetDocumentCheckpointContentResponseDto,
} from '@converge/shared';
import { DatabaseService } from '../db/database.service.js';
import { DocumentAccessService } from './document-access.service.js';
import { uint8ArrayToBase64 } from '../utils/utils.js';
import { sql } from 'kysely';

@Injectable()
export class DocumentCheckpointService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly documentAccessService: DocumentAccessService,
  ) {}

  /**
   * Takes a manual version-history checkpoint for the given document on
   * behalf of an authenticated user. Requires resolved document editor+
   * access — this is the user-initiated path (e.g. a "save version" button).
   * Automatic checkpoints triggered by the scheduler have no requesting user
   * and call createCheckpointInternal directly instead, skipping this check.
   * @param documentId - the document to checkpoint
   * @param userId - the authenticated user requesting the checkpoint (must have editor+ resolved access)
   * @returns whether a checkpoint was created, its id if so, and a message
   * explaining the outcome either way
   * @throws 403 if the user does not have editor+ access to the document
   */
  async createCheckpoint(
    documentId: number,
    userId: number,
  ): Promise<{
    created: boolean;
    checkpointId: number | null;
    message: string;
  }> {
    // Verify the caller has editor+ resolved access — same bar as pushing content edits.
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'editor'))
      throw new ForbiddenException('You do not have access to this document.');

    return this.createCheckpointInternal(documentId, 'manual');
  }

  /**
   * Core checkpoint-creation logic, with no access check — callable both by
   * createCheckpoint (after it has verified the requesting user) and by the
   * scheduler's automatic triggers (which have no requesting user at all).
   * Merges every document_updates row since the previous checkpoint (or
   * since the beginning, if none exists) into one new row flagged
   * is_checkpoint = true, deletes the rows just folded into it, and records
   * which users contributed since the previous checkpoint.
   * @param documentId - the document to checkpoint
   * @param source - what triggered this checkpoint, recorded on the new row
   * @returns whether a checkpoint was created, its id if so, and a message
   * explaining the outcome either way
   */
  async createCheckpointInternal(
    documentId: number,
    source: CheckpointSource,
  ): Promise<{
    created: boolean;
    checkpointId: number | null;
    message: string;
  }> {
    const db = this.dbService.kysely;

    return db.transaction().execute(async (tx) => {
      // Find the most recent checkpoint, if any — everything after it (and
      // up to the max id captured below) is what this new checkpoint covers.
      const lastCheckpoint = await tx
        .selectFrom('document_updates')
        .select(['id', 'created_at'])
        .where('document_id', '=', documentId)
        .where('is_checkpoint', '=', true)
        .orderBy('id', 'desc')
        .limit(1)
        .executeTakeFirst();
      const hasPreviousCheckpoint = lastCheckpoint !== undefined;

      // document_updates.id is a bigserial starting at 1, so 0 is a safe
      // sentinel for "no previous checkpoint" — id > 0 matches every row.
      // Likewise for last_edited_at: it is always set to a real timestamp
      // (defaulting to now() on insert), so the epoch is a safe sentinel
      // there too. Using these instead of branching the queries below makes
      // the "since the beginning" and "since the last checkpoint" cases a
      // single code path rather than two.
      const sinceUpdateId = hasPreviousCheckpoint ? lastCheckpoint.id : 0;
      const sinceEditedAt = hasPreviousCheckpoint
        ? lastCheckpoint.created_at
        : new Date(0);

      // Capture the current max id up front so a concurrently-inserted
      // update (landing mid-transaction) is simply left for the next
      // checkpoint, rather than partially merged and deleted here.
      const maxRow = await tx
        .selectFrom('document_updates')
        .where('document_id', '=', documentId)
        .select(sql<string | null>`max(id)`.as('maxId'))
        .executeTakeFirst();
      const maxId = maxRow?.maxId === null ? null : Number(maxRow?.maxId);

      if (maxId === null) {
        return {
          created: false,
          checkpointId: null,
          message: 'This document has no updates to checkpoint yet.',
        };
      }
      if (maxId <= sinceUpdateId) {
        return {
          created: false,
          checkpointId: null,
          message: 'No changes since the last checkpoint.',
        };
      }

      // Fetch every row strictly after the last checkpoint, up to maxId, in order.
      const rows = await tx
        .selectFrom('document_updates')
        .select(['update', 'created_at'])
        .where('document_id', '=', documentId)
        .where('id', '>', sinceUpdateId)
        .where('id', '<=', maxId)
        .orderBy('id', 'asc')
        .execute();

      // Merge the raw Yjs update bytes — no diffing, just the literal bytes
      // already persisted for normal sync.
      const merged = Y.mergeUpdates(rows.map((r) => new Uint8Array(r.update)));

      // The latest created_at among the folded rows — when the actual last
      // edit in this checkpoint happened, as opposed to created_at below
      // (when this checkpoint row itself gets inserted, which can lag behind
      // for automatic checkpoints). rows is never empty here: the maxId <=
      // sinceUpdateId guard above already ruled that out.
      const contentLastEditedAt = rows.reduce(
        (latest, r) => (r.created_at > latest ? r.created_at : latest),
        rows[0].created_at,
      );

      // Insert the merged blob as the new checkpoint row.
      const inserted = await tx
        .insertInto('document_updates')
        .values({
          document_id: documentId,
          update: Buffer.from(merged),
          is_checkpoint: true,
          checkpoint_source: source,
          content_last_edited_at: contentLastEditedAt,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      // Remove the individual rows just folded into the checkpoint.
      await tx
        .deleteFrom('document_updates')
        .where('document_id', '=', documentId)
        .where('id', '>', sinceUpdateId)
        .where('id', '<=', maxId)
        .execute();

      // Record contributors: users who edited since the previous checkpoint
      // (or ever, if this is the first checkpoint).
      const contributors = await tx
        .selectFrom('document_user_metadata')
        .select('user_id')
        .where('document_id', '=', documentId)
        .where('last_edited_at', '>', sinceEditedAt)
        .execute();

      if (contributors.length > 0) {
        await tx
          .insertInto('document_checkpoint_contributors')
          .values(
            contributors.map((c) => ({
              update_id: inserted.id,
              user_id: c.user_id,
            })),
          )
          .execute();
      }

      return {
        created: true,
        checkpointId: Number(inserted.id),
        message: 'Checkpoint created.',
      };
    });
  }

  /**
   * Returns a keyset-paginated list of version-history checkpoints for the
   * document, newest first, each with its contributors. Requires resolved
   * document viewer+ access.
   * @param documentId - the document to list checkpoints for
   * @param userId - the authenticated user (must have viewer+ resolved access)
   * @param limit - maximum entries per page
   * @param cursorId - id of the oldest checkpoint from the previous page; omit for the first page
   * @returns checkpoints for this page and nextCursor (null on the last page)
   * @throws 403 if the user does not have viewer+ access to the document
   */
  async listCheckpoints(
    documentId: number,
    userId: number,
    limit: number,
    cursorId?: number,
  ): Promise<GetDocumentCheckpointsResponseDto> {
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    const db = this.dbService.kysely;

    // Keyset-paginated query ordered by id DESC — newest checkpoint first.
    let query = db
      .selectFrom('document_updates')
      .select([
        'id',
        'created_at',
        'content_last_edited_at',
        'checkpoint_source',
      ])
      .where('document_id', '=', documentId)
      .where('is_checkpoint', '=', true)
      .orderBy('id', 'desc')
      .limit(limit);

    if (cursorId !== undefined) query = query.where('id', '<', cursorId);

    const checkpointRows = await query.execute();
    const nextCursor =
      checkpointRows.length === limit
        ? checkpointRows[checkpointRows.length - 1].id
        : null;

    if (checkpointRows.length === 0) return { checkpoints: [], nextCursor };

    // Fetch every contributor for every checkpoint on this page in one query,
    // then group them in memory — cheaper than one query per checkpoint.
    const checkpointIds = checkpointRows.map((r) => r.id);
    const contributorRows = await db
      .selectFrom('document_checkpoint_contributors as dcc')
      .innerJoin('users as u', 'u.id', 'dcc.user_id')
      .select(['dcc.update_id', 'u.id', 'u.name', 'u.email', 'u.avatar_url'])
      .where('dcc.update_id', 'in', checkpointIds)
      .execute();

    const contributorsByCheckpointId = new Map<
      number,
      { id: number; name: string; email: string; avatarUrl: string | null }[]
    >();
    for (const row of contributorRows) {
      const contributors = contributorsByCheckpointId.get(row.update_id) ?? [];
      contributors.push({
        id: row.id,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
      });
      contributorsByCheckpointId.set(row.update_id, contributors);
    }

    return {
      // checkpoint_source and content_last_edited_at are nullable at the DB
      // level (meaningless for non-checkpoint rows), but every is_checkpoint
      // row always has both set by createCheckpointInternal — safe to cast
      // away the null here.
      checkpoints: checkpointRows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        lastEditedAt: r.content_last_edited_at as Date,
        contributors: contributorsByCheckpointId.get(r.id) ?? [],
        source: r.checkpoint_source as CheckpointSource,
      })),
      nextCursor,
    };
  }

  /**
   * Returns a checkpoint's metadata (id, createdAt, contributors, source —
   * the same shape as a listCheckpoints entry) plus its full reconstructed
   * content, merged from every is_checkpoint row for the document up to and
   * including the given one — there is no baseline, so this always walks
   * the full chain from the beginning. Requires resolved document viewer+
   * access.
   * @param documentId - the document the checkpoint belongs to
   * @param userId - the authenticated user (must have viewer+ resolved access)
   * @param checkpointId - the checkpoint to reconstruct
   * @returns the checkpoint's metadata and content as a base64-encoded Yjs update
   * @throws 403 if the user does not have viewer+ access to the document
   * @throws 404 if checkpointId is not a checkpoint row on this document
   */
  async getCheckpointContent(
    documentId: number,
    userId: number,
    checkpointId: number,
  ): Promise<GetDocumentCheckpointContentResponseDto> {
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    const db = this.dbService.kysely;

    // Verify checkpointId actually refers to a checkpoint row on this
    // document, fetching its metadata in the same query.
    const checkpointRow = await db
      .selectFrom('document_updates')
      .select([
        'id',
        'created_at',
        'content_last_edited_at',
        'checkpoint_source',
      ])
      .where('id', '=', checkpointId)
      .where('document_id', '=', documentId)
      .where('is_checkpoint', '=', true)
      .executeTakeFirst();

    if (!checkpointRow) throw new NotFoundException('Checkpoint not found.');

    // Fetch this checkpoint's contributors.
    const contributorRows = await db
      .selectFrom('document_checkpoint_contributors as dcc')
      .innerJoin('users as u', 'u.id', 'dcc.user_id')
      .select(['u.id', 'u.name', 'u.email', 'u.avatar_url'])
      .where('dcc.update_id', '=', checkpointId)
      .execute();

    // Merge every checkpoint row up to and including this one, in order. The
    // is_checkpoint filter matters here beyond just "only checkpoints are
    // relevant": Postgres assigns bigserial ids at statement-execution time,
    // not commit time, so a concurrent applyDocUpdate insert can land with a
    // lower id than a checkpoint whose creation started earlier but committed
    // later. Filtering on id alone could pull that stray, not-yet-checkpointed
    // row into the merge even though it was never part of this checkpoint.
    const rows = await db
      .selectFrom('document_updates')
      .select('update')
      .where('document_id', '=', documentId)
      .where('is_checkpoint', '=', true)
      .where('id', '<=', checkpointId)
      .orderBy('id', 'asc')
      .execute();

    const merged = Y.mergeUpdates(rows.map((r) => new Uint8Array(r.update)));

    return {
      id: checkpointRow.id,
      createdAt: checkpointRow.created_at,
      // checkpoint_source and content_last_edited_at are nullable at the DB
      // level (meaningless for non-checkpoint rows), but every is_checkpoint
      // row always has both set by createCheckpointInternal — safe to cast
      // away the null here.
      lastEditedAt: checkpointRow.content_last_edited_at as Date,
      source: checkpointRow.checkpoint_source as CheckpointSource,
      contributors: contributorRows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        avatarUrl: r.avatar_url,
      })),
      updateBase64: uint8ArrayToBase64(merged),
    };
  }
}
