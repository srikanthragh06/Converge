import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { sql, type Transaction } from 'kysely';
import { hasAccess, type DocumentIndexingStatus } from '@converge/shared';
import { DatabaseService } from '../db/database.service.js';
import type { DatabaseSchema } from '../db/database.schema.js';
import { DocumentYjsService } from './document-yjs.service.js';
import { DocumentEmbeddingService } from './document-embedding.service.js';
import { DocumentAccessService } from './document-access.service.js';
import { blocksFromYDoc, markdownFromBlock } from '../utils/editor-schema.js';
import {
  chunkBlocks,
  countTokens,
  groupIntoSections,
  type BlockText,
} from '../utils/chunking.util.js';
import { IndexingCappedError } from './indexing-capped.error.js';

@Injectable()
export class DocumentIndexingService {
  /**
   * Upper bound on how many chunks a single reindexDocument run will embed
   * before deliberately stopping and deferring the rest to a follow-up run
   * (via IndexingCappedError). Bounds how much of a workspace's shared
   * embed rate-limit budget (300 RPM — see DocumentEmbeddingService) one
   * giant edit can consume in a single job, and keeps this run's
   * forUpdate-locked transaction from holding that lock for an unbounded
   * duration.
   */
  private static readonly MAX_CHUNKS_PER_RUN = 50;

  constructor(
    private readonly dbService: DatabaseService,
    private readonly documentYjsService: DocumentYjsService,
    private readonly documentEmbeddingService: DocumentEmbeddingService,
    private readonly documentAccessService: DocumentAccessService,
  ) {}

  /**
   * Returns a document's current RAG indexing status: its lifecycle state
   * (idle/pending/indexing) and when it was last confirmed indexed. Requires
   * resolved document viewer+ access.
   * @param documentId - the document to check
   * @param userId - the authenticated user (must have viewer+ resolved access)
   * @returns the document's indexing status and last-indexed timestamp (null if never indexed)
   * @throws 404 if the document does not exist
   * @throws 403 if the user does not have viewer+ access to the document
   */
  async getIndexingStatus(
    documentId: number,
    userId: number,
  ): Promise<{
    indexingStatus: DocumentIndexingStatus;
    lastIndexedAt: Date | null;
  }> {
    const access = await this.documentAccessService.resolveAccess(
      documentId,
      userId,
    );
    if (!hasAccess(access, 'viewer'))
      throw new ForbiddenException('You do not have access to this document.');

    const row = await this.dbService.kysely
      .selectFrom('documents')
      .select(['indexing_status', 'last_indexed_at'])
      .where('id', '=', documentId)
      .executeTakeFirstOrThrow();

    return {
      indexingStatus: row.indexing_status,
      lastIndexedAt: row.last_indexed_at,
    };
  }

  /**
   * Re-indexes a document: diffs its current blocks against the last
   * indexed state, and re-chunks + re-embeds only the neighborhood of
   * blocks that actually changed, rather than the whole document. Also
   * incrementally maintains this workspace's BM25 stats (per-term document
   * frequency, and the running totals behind average chunk length) so
   * retrieval never has to scan the corpus to compute them. On any
   * successful completion (including a no-op run that finds nothing
   * changed) marks the document idle with a fresh last_indexed_at — see
   * markIndexed. If the rebuild set needs more than MAX_CHUNKS_PER_RUN
   * chunks embedded (or a real embed rate-limit rejection cuts a run
   * short), commits only what was actually embedded this run — hashes and
   * stale-chunk deletion both scoped to just the blocks that actually got
   * a fresh chunk (or were removed outright) — and throws
   * IndexingCappedError instead of calling markIndexed. An old chunk whose
   * replacement didn't finish this run is left in place rather than
   * deleted: search over that content keeps returning the pre-edit text
   * (better than a hole in the index) until a follow-up run finishes
   * replacing it. The document is left 'pending' (not 'idle'), and the
   * next scheduled attempt picks up wherever the block-hash diff still
   * shows changes. No access check — internal-only, called by
   * DocumentIndexingSchedulerService after the gateway has already verified
   * the edit that triggered this
   * run (same split as DocumentCheckpointService.createCheckpointInternal).
   * @param documentId - the document to re-index
   * @throws IndexingCappedError if the run stopped early after hitting
   * MAX_CHUNKS_PER_RUN or a real rate-limit rejection — the caller should
   * treat this as a scheduled continuation, not a failure
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

    // Every block's section, keyed by every block id in it — headingless
    // sections excluded on purpose. Section-closure below exists solely to
    // protect chunkBlocks' small-heading-count check, which only ever
    // looks at sections that start with a heading; a headingless section
    // can never affect that check, so there's nothing to protect by
    // expanding into one. Skipping them matters in practice: without this,
    // a document with sparse or no headings would have its single
    // headingless section span the whole document, and any edit would
    // section-closure its way into a full-document rebuild every time.
    // A block missing from this map is one this run treats as needing no
    // section expansion — either it no longer exists, its Markdown is now
    // empty (see the `if (!text) continue` skip above), or its section has
    // no heading.
    const sectionBlockIdsById = new Map<string, string[]>();
    for (const section of groupIntoSections(blockTexts)) {
      if (!section.hasHeading) continue;
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
    // completedFully tells the caller (outside the transaction, once it has
    // committed) whether to throw IndexingCappedError. Thrown after commit,
    // never from inside the callback below — throwing inside would roll
    // back the partial progress this whole cap exists to preserve.
    const completedFully = await db.transaction().execute(async (tx) => {
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
      // Still marks the document freshly indexed: a run that confirms there's
      // nothing to change is exactly what "last indexed" should mean here,
      // not "last time content actually changed" — otherwise a long-idle,
      // already-up-to-date document would misleadingly look stale.
      if (
        addedBlockIds.size === 0 &&
        removedBlockIds.size === 0 &&
        changedBlockIds.size === 0
      ) {
        await this.markIndexed(tx, documentId);
        return true;
      }

      // A brand-new block has no chunk of its own yet, and isn't
      // guaranteed to be swept up by section-closure below either (it
      // won't be, if it lands in headingless territory). Left alone, it
      // would index as an isolated singleton with no surrounding context
      // in its embedding. To avoid that, anchor each added block to its
      // nearest still-existing neighbor in document order — skipping past
      // other added blocks, which have no chunk of their own to anchor to
      // either — so that seeding the rebuild with the anchor lets the
      // closure loop below naturally pull in whatever chunk or section the
      // anchor belongs to, merging the new block into that rebuild instead
      // of standing alone. Falls back to searching forward when there's no
      // existing block before it (e.g. an insert at the very start of the
      // document); if there's truly no existing block in either direction
      // (e.g. this is the document's first-ever index), the block just
      // gets indexed on its own — there's nothing to anchor to.
      const orderedBlockIndexById = new Map(
        orderedBlockIds.map((blockId, index) => [blockId, index]),
      );
      const neighborAnchorBlockIds = new Set<string>();
      for (const blockId of addedBlockIds) {
        const index = orderedBlockIndexById.get(blockId)!;
        let anchor: string | undefined;
        for (let i = index - 1; i >= 0; i--) {
          if (!addedBlockIds.has(orderedBlockIds[i])) {
            anchor = orderedBlockIds[i];
            break;
          }
        }
        if (!anchor) {
          for (let i = index + 1; i < orderedBlockIds.length; i++) {
            if (!addedBlockIds.has(orderedBlockIds[i])) {
              anchor = orderedBlockIds[i];
              break;
            }
          }
        }
        if (anchor) neighborAnchorBlockIds.add(anchor);
      }

      // Grow the rebuild set to a fixed point: every block directly touched
      // by the diff, plus every added block's neighbor anchor above, pulls
      // in (a) every block sharing an existing chunk with it, so a chunk is
      // never partially deleted and left with orphaned survivors, and (b)
      // every block in its heading section, so the chunker above always
      // sees a section's true, complete size instead of a partial one.
      // Each of those can in turn land in a chunk or section not yet
      // accounted for, so this repeats until a full pass adds nothing new
      // — bounded, since the set only ever grows and the whole document is
      // a hard ceiling.
      const rebuildBlockIds = new Set<string>([
        ...addedBlockIds,
        ...removedBlockIds,
        ...changedBlockIds,
        ...neighborAnchorBlockIds,
      ]);
      const staleChunkIds = new Set<number>();
      // Every stale chunk's own block_ids, captured the first time closure
      // discovers it — needed below (after the embed loop) to work out
      // whether a given stale chunk is actually safe to delete yet: only
      // once every block it spans has either been removed from the
      // document, or got a fresh chunk inserted this run.
      const staleChunkBlockIdsById = new Map<number, string[]>();
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
            staleChunkBlockIdsById.set(chunk.id, chunk.block_ids);
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
          if (!sectionBlockIds) continue; // no heading section to protect (removed, empty, or headingless)
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
      // content — into one chunk. Term/token stats for every chunk created
      // here are netted against removedTermCounts/removedChunkCount/
      // removedTokenTotal (computed below, once the final deletable set is
      // known) as a single delta applied to the running BM25 stats tables.
      //
      // Stops after MAX_CHUNKS_PER_RUN chunks rather than embedding the
      // full rebuild set — a single giant paste could otherwise burn far
      // more of the workspace's shared embed rate-limit budget than any one
      // job should, and would hold this transaction's forUpdate lock for as
      // long as it takes. Also stops (without treating it as a failure) if
      // the real embed rate limiter rejects a call — see the catch below.
      // processedBlockIds tracks exactly which blocks got a real chunk
      // inserted, so the hash writes and stale-chunk deletion below can
      // both be scoped to only those; any block left out keeps its old (or
      // absent) hash and old chunk, and is picked up again, unchanged, by
      // the next run's ordinary diff logic.
      const addedTermCounts = new Map<string, number>();
      const processedBlockIds = new Set<string>();
      let addedChunkCount = 0;
      let addedTokenTotal = 0;
      let completedFully = true;
      runsLoop: for (const run of rebuildRuns) {
        for (const chunk of chunkBlocks(run)) {
          if (addedChunkCount >= DocumentIndexingService.MAX_CHUNKS_PER_RUN) {
            completedFully = false;
            break runsLoop;
          }
          let embedding: number[];
          try {
            embedding = await this.documentEmbeddingService.embed(
              chunk.content,
              workspaceId,
            );
          } catch (err) {
            // MAX_CHUNKS_PER_RUN only makes it unlikely this run reaches the
            // real embed rate limit — concurrent load elsewhere in the same
            // workspace (another document indexing, or a live search) can
            // still exhaust the shared budget before this run's own count
            // gets there. checkRateLimit's rejection (embed() throwing
            // HttpException 429, per document-embedding.service.ts) happens
            // before any DB call for this chunk, so the transaction isn't in
            // a failed state — safe to catch here and stop the same way a
            // voluntary cap-hit does, committing what's already inserted
            // instead of rolling the whole run back. Any other error (a
            // real OpenAI failure, a network error) isn't ours to swallow —
            // rethrow so the transaction rolls back as it always did.
            if (
              err instanceof HttpException &&
              err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
            ) {
              completedFully = false;
              break runsLoop;
            }
            throw err;
          }
          const inserted = await tx
            .insertInto('document_chunks')
            .values({
              document_id: documentId,
              workspace_id: workspaceId,
              block_ids: chunk.blockIds,
              content: chunk.content,
              token_count: chunk.tokens,
              embedding: `[${embedding.join(',')}]`,
            })
            .returning(
              sql<string[]>`tsvector_to_array(content_tsv)`.as('terms'),
            )
            .executeTakeFirstOrThrow();
          addedChunkCount++;
          addedTokenTotal += chunk.tokens;
          for (const blockId of chunk.blockIds) {
            processedBlockIds.add(blockId);
          }
          for (const term of inserted.terms) {
            addedTermCounts.set(term, (addedTermCounts.get(term) ?? 0) + 1);
          }
        }
      }

      // A stale chunk is only safe to delete once every block it spans is
      // accounted for: either it got a fresh chunk inserted just above, or
      // it was removed from the document entirely (removedBlockIds is
      // fixed before the loop and never depends on how much of the loop
      // ran). A chunk left out here — the run covering some of its blocks
      // got cut short by the cap or a rate-limit rejection — simply isn't
      // touched, so its (now partially stale) old text stays searchable
      // until a follow-up run finishes replacing it.
      const deletableChunkIds = [...staleChunkBlockIdsById]
        .filter(([, blockIds]) =>
          blockIds.every(
            (blockId) =>
              processedBlockIds.has(blockId) || removedBlockIds.has(blockId),
          ),
        )
        .map(([chunkId]) => chunkId);

      // Capture every deletable chunk's distinct terms and token count
      // before deleting it — both are needed to decrement the BM25 term/
      // corpus stats this reindex invalidates, and the row won't exist to
      // query afterward.
      const removedTermCounts = new Map<string, number>();
      let removedChunkCount = 0;
      let removedTokenTotal = 0;
      if (deletableChunkIds.length) {
        const staleChunks = await tx
          .selectFrom('document_chunks')
          .select([
            'token_count',
            sql<string[]>`tsvector_to_array(content_tsv)`.as('terms'),
          ])
          .where('id', 'in', deletableChunkIds)
          .execute();
        for (const chunk of staleChunks) {
          removedChunkCount++;
          removedTokenTotal += chunk.token_count;
          for (const term of chunk.terms) {
            removedTermCounts.set(term, (removedTermCounts.get(term) ?? 0) + 1);
          }
        }
        await tx
          .deleteFrom('document_chunks')
          .where('id', 'in', deletableChunkIds)
          .execute();
      }

      // Store fresh hashes only for added/changed blocks that actually got
      // re-embedded this run (see processedBlockIds above); drop hash rows
      // for blocks that no longer exist — removal needs no embed call, so
      // it's never held back by the cap.
      const hashesToStore = [...addedBlockIds, ...changedBlockIds]
        .filter((blockId) => processedBlockIds.has(blockId))
        .map((blockId) => ({
          document_id: documentId,
          block_id: blockId,
          hash: currentBlockHashById.get(blockId)!,
        }));
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

      // Apply the net of this run's term/token changes to the
      // incrementally-maintained BM25 stats — document frequency per term,
      // and the running totals behind this workspace's average chunk
      // length. A term touched by both an added and a removed chunk in the
      // same run (e.g. an edit that shifts which chunk it lives in)
      // collapses to a single net upsert here rather than two writes.
      const termDelta = new Map<string, number>();
      for (const [term, count] of removedTermCounts) {
        termDelta.set(term, (termDelta.get(term) ?? 0) - count);
      }
      for (const [term, count] of addedTermCounts) {
        termDelta.set(term, (termDelta.get(term) ?? 0) + count);
      }
      const termDeltaRows = [...termDelta]
        .filter(([, delta]) => delta !== 0)
        .map(([term, delta]) => ({
          workspace_id: workspaceId,
          term,
          document_frequency: delta,
        }));
      if (termDeltaRows.length) {
        await tx
          .insertInto('document_chunk_term_stats')
          .values(termDeltaRows)
          .onConflict((oc) =>
            oc.columns(['workspace_id', 'term']).doUpdateSet({
              document_frequency: sql`document_chunk_term_stats.document_frequency + excluded.document_frequency`,
            }),
          )
          .execute();
        // A term's last chunk in this workspace was just removed — clean up
        // the zeroed (or, if this run ever double-counted, negative) row so
        // an absent row keeps meaning "this term doesn't exist here" rather
        // than accumulating stale rows over time.
        await tx
          .deleteFrom('document_chunk_term_stats')
          .where('workspace_id', '=', workspaceId)
          .where('document_frequency', '<=', 0)
          .execute();
      }

      const chunkCountDelta = addedChunkCount - removedChunkCount;
      const tokenTotalDelta = addedTokenTotal - removedTokenTotal;
      if (chunkCountDelta !== 0 || tokenTotalDelta !== 0) {
        await tx
          .insertInto('document_chunk_corpus_stats')
          .values({
            workspace_id: workspaceId,
            total_chunks: chunkCountDelta,
            total_tokens: tokenTotalDelta,
          })
          .onConflict((oc) =>
            oc.column('workspace_id').doUpdateSet({
              total_chunks: sql`document_chunk_corpus_stats.total_chunks + excluded.total_chunks`,
              total_tokens: sql`document_chunk_corpus_stats.total_tokens + excluded.total_tokens`,
            }),
          )
          .execute();
      }

      // Only a fully-completed run gets to call markIndexed — a capped run
      // left real work for a follow-up, so last_indexed_at must not advance
      // and indexing_status must not read 'idle' (the caller sets it back
      // to 'pending' when it catches IndexingCappedError below).
      if (completedFully) {
        await this.markIndexed(tx, documentId);
      }
      return completedFully;
    });

    if (!completedFully) {
      throw new IndexingCappedError(documentId);
    }
  }

  /**
   * Marks a document as freshly, successfully indexed: resets
   * indexing_status to 'idle' and stamps last_indexed_at with the current
   * time. Called from reindexDocument's no-op early return and from the end
   * of a fully-completed run — never from a run that stopped early after
   * hitting MAX_CHUNKS_PER_RUN or a rate-limit rejection (that path throws
   * IndexingCappedError instead, leaving the document 'pending') — so this
   * only ever runs as part of a genuinely complete run. If the transaction
   * rolls back (a real error mid-run), this update rolls back with it too,
   * correctly leaving last_indexed_at unchanged rather than reporting a
   * falsely-fresh time.
   * @param tx - the open transaction reindexDocument is already running in
   * @param documentId - the document that was just successfully indexed
   */
  private async markIndexed(
    tx: Transaction<DatabaseSchema>,
    documentId: number,
  ): Promise<void> {
    await tx
      .updateTable('documents')
      .set({ indexing_status: 'idle', last_indexed_at: sql`now()` })
      .where('id', '=', documentId)
      .execute();
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
