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
    const currentDocBlockHashMap = new Map<string, string>();
    for (const block of blocks) {
      const text = (await markdownFromBlock(block)).trim();
      if (!text) continue; // empty blocks carry nothing to index
      blockTexts.push({ blockId: block.id, text, tokens: countTokens(text) });
      currentDocBlockHashMap.set(block.id, this.hashBlockText(text));
    }

    // blockTexts preserves document order (blocksFromYDoc's order), which
    // chunkBlocks below relies on to group only consecutive blocks.
    const blockTextById = new Map(blockTexts.map((b) => [b.blockId, b]));
    const orderedBlockIds = blockTexts.map((b) => b.blockId);

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
      const existingBlockHashMap = new Map(
        existingBlockHashRows.map((r) => [r.block_id, r.hash]),
      );

      // Block ids as of the last index run, vs. block ids in the document
      // right now.
      const oldBlockIds = new Set(existingBlockHashMap.keys());
      const newBlockIds = new Set(currentDocBlockHashMap.keys());

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
            existingBlockHashMap.get(blockId) !==
              currentDocBlockHashMap.get(blockId),
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

      // Every existing chunk that spans a removed or changed block is now
      // stale and has to be rebuilt.
      const touchedBlockIds = [...removedBlockIds, ...changedBlockIds];
      const staleChunks = touchedBlockIds.length
        ? await tx
            .selectFrom('document_chunks')
            .select(['id', 'block_ids'])
            .where('document_id', '=', documentId)
            .where(
              sql<boolean>`block_ids && ${sql.val(touchedBlockIds)}::text[]`,
            )
            .execute()
        : [];
      const chunkIdsToDelete = new Set(staleChunks.map((chunk) => chunk.id));

      // The blocks that need to be re-chunked: every block a stale chunk
      // used to span (not just the specific block that changed — a
      // chunk's other, unchanged blocks would otherwise fall out of the
      // index entirely), plus every added/changed block, minus removed
      // ones (they no longer exist in the live doc to re-chunk).
      const blockIdsToReindex = new Set<string>();
      for (const chunk of staleChunks) {
        for (const blockId of chunk.block_ids) blockIdsToReindex.add(blockId);
      }
      for (const blockId of addedBlockIds) blockIdsToReindex.add(blockId);
      for (const blockId of changedBlockIds) blockIdsToReindex.add(blockId);
      for (const blockId of removedBlockIds) blockIdsToReindex.delete(blockId);

      // Edge case: a newly added block isn't part of any existing chunk
      // yet. If its immediate neighbor in document order isn't already
      // being rebuilt, pull the neighbor's whole chunk in too, so the new
      // block merges into that chunk's rebuild instead of being indexed
      // as an orphaned singleton with no surrounding context.
      for (const blockId of addedBlockIds) {
        const idx = orderedBlockIds.indexOf(blockId);
        const neighborBlockId =
          orderedBlockIds[idx - 1] ?? orderedBlockIds[idx + 1];
        if (
          neighborBlockId === undefined ||
          blockIdsToReindex.has(neighborBlockId)
        )
          continue;

        const neighborChunk = await tx
          .selectFrom('document_chunks')
          .select(['id', 'block_ids'])
          .where('document_id', '=', documentId)
          .where(
            sql<boolean>`${sql.val(neighborBlockId)}::text = ANY(block_ids)`,
          )
          .executeTakeFirst();
        if (!neighborChunk) continue; // neighbor has no chunk of its own yet either

        chunkIdsToDelete.add(neighborChunk.id);
        for (const spanBlockId of neighborChunk.block_ids) {
          blockIdsToReindex.add(spanBlockId);
        }
      }

      // Delete every stale chunk, then re-chunk and re-embed the full
      // rebuild set, in document order.
      if (chunkIdsToDelete.size) {
        await tx
          .deleteFrom('document_chunks')
          .where('id', 'in', [...chunkIdsToDelete])
          .execute();
      }

      const rebuildBlockTexts = orderedBlockIds
        .filter((blockId) => blockIdsToReindex.has(blockId))
        .map((blockId) => blockTextById.get(blockId)!);

      for (const chunk of chunkBlocks(rebuildBlockTexts)) {
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

      // Store fresh hashes for added/changed blocks so the next run's
      // diff is accurate; drop hash rows for blocks that no longer exist.
      const hashesToStore = [...addedBlockIds, ...changedBlockIds].map(
        (blockId) => ({
          document_id: documentId,
          block_id: blockId,
          hash: currentDocBlockHashMap.get(blockId)!,
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
