import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { sql } from 'kysely';
import { DatabaseService } from '../db/database.service.js';
import { DocumentYjsService } from './document-yjs.service.js';
import { DocumentEmbeddingService } from './document-embedding.service.js';
import { blocksFromYDoc, markdownFromBlock } from '../utils/editor-schema.js';
import {
  chunkBlocks,
  countTokens,
  groupIntoSections,
  type BlockText,
} from '../utils/chunking.util.js';

@Injectable()
export class DocumentIndexingService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly documentYjsService: DocumentYjsService,
    private readonly documentEmbeddingService: DocumentEmbeddingService,
  ) {}

  /**
   * Re-indexes a document: diffs its current blocks against the last
   * indexed state, and re-chunks + re-embeds only the neighborhood of
   * blocks that actually changed, rather than the whole document. No
   * access check — internal-only, called by
   * DocumentIndexingSchedulerService after the gateway has already
   * verified the edit that triggered this run (same split as
   * DocumentCheckpointService.createCheckpointInternal).
   * @param documentId - the document to re-index
   */
  async reindexDocument(documentId: number): Promise<void> {
    // Load the document's current content and convert every block to
    // Markdown up front — slow (jsdom-mutex-serialized) work that doesn't
    // need a DB lock, so it happens before the transaction opens rather
    // than inside it. rebuild: true — this runs as a scheduled background
    // job, not a live socket connection, so there's no guarantee this
    // server instance was ever subscribed to this document's Redis updates
    // (see DocumentYjsService.loadDoc); the cached copy could be silently
    // stale, so always reconstruct fresh from document_updates instead.
    const yDoc = await this.documentYjsService.loadDoc(documentId, true);
    const blocks = blocksFromYDoc(yDoc);
    const blockTexts: BlockText[] = [];
    const currentBlockHashById = new Map<string, string>();
    for (const block of blocks) {
      const text = (await markdownFromBlock(block)).trim();
      if (!text) continue; // empty blocks carry nothing to index
      blockTexts.push({
        blockId: block.id,
        text,
        tokens: countTokens(text),
        isHeading: block.type === 'heading',
      });
      currentBlockHashById.set(block.id, this.hashBlockText(text));
    }

    // blockTexts preserves document order (blocksFromYDoc's order). Both
    // the section grouping below and the contiguous-run split further down
    // rely on that order to know which blocks are actually adjacent in the
    // live document.
    const blockTextById = new Map(blockTexts.map((b) => [b.blockId, b]));
    const orderedBlockIds = blockTexts.map((b) => b.blockId);

    // Every block's section, keyed by every block id in it. A block not in
    // this map is one this run treats as removed for indexing purposes —
    // either it no longer exists in the document, or its Markdown is now
    // empty (see the `if (!text) continue` skip above).
    const sectionBlockIdsById = new Map<string, string[]>();
    for (const section of groupIntoSections(blockTexts)) {
      for (const blockId of section.blockIds) {
        sectionBlockIdsById.set(blockId, section.blockIds);
      }
    }

    const db = this.dbService.kysely;

    // The whole diff-and-rewrite runs in one transaction, forUpdate-locking
    // this document's hash rows, so two reindex runs of the SAME document
    // (e.g. a slow run still embedding while a fresh edit re-triggers the
    // scheduler) can't race each other's read-then-write. Embedding calls
    // happen inside this transaction too — holding the lock a bit longer
    // in exchange for a single, simple, race-free critical section; this
    // is a background job, not a request in the hot path, so the extra
    // lock duration costs nothing user-facing.
    await db.transaction().execute(async (tx) => {
      // workspace_id is denormalized onto every new document_chunks row —
      // fetched once here rather than threaded through as a parameter.
      const { workspace_id: workspaceId } = await tx
        .selectFrom('documents')
        .select('workspace_id')
        .where('id', '=', documentId)
        .executeTakeFirstOrThrow();

      // Lock and read this document's stored hashes from the last run.
      const existingBlockHashRows = await tx
        .selectFrom('document_block_hashes')
        .select(['block_id', 'hash'])
        .where('document_id', '=', documentId)
        .forUpdate()
        .execute();
      const oldBlockHashById = new Map(
        existingBlockHashRows.map((r) => [r.block_id, r.hash]),
      );

      // Block ids as of the last index run, vs. block ids in the document
      // right now.
      const oldBlockIds = new Set(oldBlockHashById.keys());
      const newBlockIds = new Set(currentBlockHashById.keys());

      // Newly added blocks — in the document now, weren't indexed before.
      const addedBlockIds = new Set(
        [...newBlockIds].filter((blockId) => !oldBlockIds.has(blockId)),
      );
      // Removed blocks — were indexed before, no longer exist.
      const removedBlockIds = new Set(
        [...oldBlockIds].filter((blockId) => !newBlockIds.has(blockId)),
      );
      // Of the blocks present both before and after, the ones whose
      // content actually changed (same block id, different hash).
      const changedBlockIds = new Set(
        [...oldBlockIds].filter(
          (blockId) =>
            newBlockIds.has(blockId) &&
            oldBlockHashById.get(blockId) !== currentBlockHashById.get(blockId),
        ),
      );

      // Nothing changed since the last run — leave existing chunks as-is.
      if (
        addedBlockIds.size === 0 &&
        removedBlockIds.size === 0 &&
        changedBlockIds.size === 0
      ) {
        return;
      }

      // Grow the rebuild set to a fixed point: any block directly touched
      // by the diff pulls in (a) every block sharing an existing chunk with
      // it, so a chunk is never partially deleted and left with orphaned
      // survivors, and (b) every block in its heading section, so the
      // chunker above always sees a section's true, complete size instead
      // of a partial one. Each of those can in turn land in a chunk or
      // section not yet accounted for, so this repeats until a full pass
      // adds nothing new — bounded, since the set only ever grows and the
      // whole document is a hard ceiling.
      const rebuildBlockIds = new Set<string>([
        ...addedBlockIds,
        ...removedBlockIds,
        ...changedBlockIds,
      ]);
      const staleChunkIds = new Set<number>();
      let grew = true;
      while (grew) {
        grew = false;

        // (a) Chunk-closure: any existing chunk that overlaps the rebuild
        // set is stale, and every other block that chunk spans has to join
        // the rebuild set too — otherwise deleting the chunk would silently
        // drop its unchanged blocks from the index entirely.
        const overlappingChunks = await tx
          .selectFrom('document_chunks')
          .select(['id', 'block_ids'])
          .where('document_id', '=', documentId)
          .where(
            sql<boolean>`block_ids && ${sql.val([...rebuildBlockIds])}::text[]`,
          )
          .execute();
        for (const chunk of overlappingChunks) {
          if (!staleChunkIds.has(chunk.id)) {
            staleChunkIds.add(chunk.id);
            grew = true;
          }
          for (const blockId of chunk.block_ids) {
            if (!rebuildBlockIds.has(blockId)) {
              rebuildBlockIds.add(blockId);
              grew = true;
            }
          }
        }

        // (b) Section-closure: any block in the rebuild set pulls in every
        // other block in its heading section, so the chunker always sees a
        // section's true, complete size rather than a partial one.
        for (const blockId of [...rebuildBlockIds]) {
          const sectionBlockIds = sectionBlockIdsById.get(blockId);
          if (!sectionBlockIds) continue; // block no longer exists (removed)
          for (const sectionBlockId of sectionBlockIds) {
            if (!rebuildBlockIds.has(sectionBlockId)) {
              rebuildBlockIds.add(sectionBlockId);
              grew = true;
            }
          }
        }

        // (a) and (b) can each reveal more territory for the other — a
        // pulled-in section can span into a fresh chunk, and a pulled-in
        // chunk can span into a fresh section — so the loop keeps going
        // until a full pass adds nothing new.
      }

      // Every chunk touched by (a) above, across every pass, is stale.
      if (staleChunkIds.size) {
        await tx
          .deleteFrom('document_chunks')
          .where('id', 'in', [...staleChunkIds])
          .execute();
      }

      // Split the rebuild set into contiguous runs, using the live
      // document's real order — a rebuild set can span two unrelated,
      // far-apart parts of the document (e.g. two edits in the same idle
      // window), and blocks from different runs must never be chunked
      // together just because both happened to need rebuilding. Removed
      // block ids never appear in orderedBlockIds, so they drop out here
      // naturally.
      const rebuildRuns: BlockText[][] = [];
      let currentRun: BlockText[] = [];
      for (const blockId of orderedBlockIds) {
        if (rebuildBlockIds.has(blockId)) {
          currentRun.push(blockTextById.get(blockId)!);
        } else if (currentRun.length) {
          rebuildRuns.push(currentRun);
          currentRun = [];
        }
      }
      if (currentRun.length) rebuildRuns.push(currentRun);

      // Chunk and embed each run on its own, so nothing ever merges blocks
      // across a run boundary — i.e. across untouched, still-indexed
      // content — into one chunk.
      for (const run of rebuildRuns) {
        for (const chunk of chunkBlocks(run)) {
          const embedding = await this.documentEmbeddingService.embed(
            chunk.content,
          );
          await tx
            .insertInto('document_chunks')
            .values({
              document_id: documentId,
              workspace_id: workspaceId,
              block_ids: chunk.blockIds,
              content: chunk.content,
              embedding: `[${embedding.join(',')}]`,
            })
            .execute();
        }
      }

      // Store fresh hashes for added/changed blocks so the next run's
      // diff is accurate; drop hash rows for blocks that no longer exist.
      const hashesToStore = [...addedBlockIds, ...changedBlockIds].map(
        (blockId) => ({
          document_id: documentId,
          block_id: blockId,
          hash: currentBlockHashById.get(blockId)!,
        }),
      );
      if (hashesToStore.length) {
        await tx
          .insertInto('document_block_hashes')
          .values(hashesToStore)
          .onConflict((oc) =>
            oc.columns(['document_id', 'block_id']).doUpdateSet((eb) => ({
              hash: eb.ref('excluded.hash'),
              updated_at: sql`now()`,
            })),
          )
          .execute();
      }
      if (removedBlockIds.size) {
        await tx
          .deleteFrom('document_block_hashes')
          .where('document_id', '=', documentId)
          .where('block_id', 'in', [...removedBlockIds])
          .execute();
      }
    });
  }

  /**
   * Hashes a block's Markdown content for change detection. Not
   * cryptographic use — SHA-256 is just a convenient, collision-safe
   * fingerprint.
   * @param text - the block's Markdown content
   * @returns a hex-encoded content hash
   */
  private hashBlockText(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }
}
