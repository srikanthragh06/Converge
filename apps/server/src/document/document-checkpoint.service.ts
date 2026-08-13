import { ForbiddenException, Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import { hasAccess } from '@converge/shared';
import { DatabaseService } from '../db/database.service';
import { DocumentAccessService } from './document-access.service';
import { sql } from 'kysely';

@Injectable()
export class DocumentCheckpointService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly documentAccessService: DocumentAccessService,
  ) {}

  /**
   * Takes a version-history checkpoint for the given document: merges every
   * document_updates row since the previous checkpoint (or since the
   * beginning, if none exists) into one new row flagged is_checkpoint = true,
   * deletes the rows just folded into it, and records which users
   * contributed since the previous checkpoint. Requires resolved document
   * editor+ access.
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
        .select('update')
        .where('document_id', '=', documentId)
        .where('id', '>', sinceUpdateId)
        .where('id', '<=', maxId)
        .orderBy('id', 'asc')
        .execute();

      // Merge the raw Yjs update bytes — no diffing, just the literal bytes
      // already persisted for normal sync.
      const merged = Y.mergeUpdates(rows.map((r) => new Uint8Array(r.update)));

      // Insert the merged blob as the new checkpoint row.
      const inserted = await tx
        .insertInto('document_updates')
        .values({
          document_id: documentId,
          update: Buffer.from(merged),
          is_checkpoint: true,
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
}
