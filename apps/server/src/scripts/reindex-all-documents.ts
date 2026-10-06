/**
 * THROWAWAY one-time script. Delete after running.
 *
 * Rebuilds the RAG index of every existing document under the current
 * chunking rules (every block, parent or child, as its own entry; oversized
 * blocks split; heading break instead of heading sections). An ordinary
 * indexing run only rebuilds blocks whose hash changed, so a document that
 * was indexed under the old rules but hasn't been edited since would keep its
 * old chunks forever. This script forces a full rebuild per document by
 * deleting its document_block_hashes rows — every block then diffs as
 * "added", chunk-closure marks every old chunk stale, and the normal
 * reindexDocument path replaces them and deletes the old ones (keeping the
 * BM25 stats correct, which deleting chunks directly would not) — then
 * drives it through the same DocumentIndexingSchedulerService.onDocumentEdited()
 * entry point a live edit uses.
 *
 * Documents are processed in batches of BATCH_SIZE: a batch's hashes are
 * cleared and its jobs queued, and the next batch only starts once every
 * document in the current one is back to 'idle' with a last_indexed_at later
 * than the batch's start — so the shared embedding budget is never asked for
 * the whole corpus at once.
 *
 * Usage (run from apps/server, after a build — `ts-node --esm` can't load
 * this project's ESM sources on Node 20, so run the compiled file):
 *   NODE_ENV=dev  node dist/scripts/reindex-all-documents.js          # dry run against dev
 *   NODE_ENV=dev  node dist/scripts/reindex-all-documents.js --run    # actually reindex, dev
 *   NODE_ENV=prod node dist/scripts/reindex-all-documents.js --run    # actually reindex, prod
 *
 * Without --run, it only prints which documents would be reindexed.
 */
import { NestFactory } from '@nestjs/core';
import { sql } from 'kysely';
import { AppModule } from '../app.module.js';
import { loadEnv } from '../utils/env.loader.js';
import { DatabaseService } from '../db/database.service.js';
import { DocumentIndexingSchedulerService } from '../document/document-indexing-scheduler.service.js';
import { sleep } from '../utils/utils.js';

const BATCH_SIZE = 5; // documents reindexed at a time
const POLL_INTERVAL_MS = 5000;
// Per batch. A long document needs several capped runs, each waiting out the
// queue's retry backoff (up to 300s), so this is deliberately generous.
const BATCH_TIMEOUT_MS = 60 * 60 * 1000;

/** console.log with an ISO timestamp prefix, so a long-running poll loop is easy to read back. */
function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function main() {
  const startedAt = Date.now();
  loadEnv();
  const dryRun = !process.argv.includes('--run');

  log(`Target environment: ${process.env.ENVIRONMENT}`);
  log(dryRun ? 'Mode: DRY RUN (pass --run to actually reindex)' : 'Mode: RUN');

  log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  log('Application context ready.');

  try {
    const dbService = app.get(DatabaseService);
    const db = dbService.kysely;
    log('Verifying database connection...');
    await dbService.verifyDBConnection();
    log('Database connection verified.');

    const targets = await db
      .selectFrom('documents')
      .select('id')
      .where('is_deleted', '=', false)
      .orderBy('id')
      .execute();
    const targetIds: number[] = [];
    for (const target of targets) {
      targetIds.push(target.id);
    }
    log(
      `Found ${targetIds.length} non-deleted document(s): ${targetIds.join(', ') || '(none)'}`,
    );

    if (dryRun) {
      log('Dry run complete — no changes made. Re-run with --run to reindex.');
      return;
    }
    if (targetIds.length === 0) {
      log('Nothing to do.');
      return;
    }

    const scheduler = app.get(DocumentIndexingSchedulerService);
    log('Starting indexing scheduler (pg-boss)...');
    // Registers the pg-boss queue/worker in this process too, so the jobs
    // get processed even if no server instance is running.
    await scheduler.start();
    log('Indexing scheduler started — this process is now a pg-boss worker.');

    const batchCount = Math.ceil(targetIds.length / BATCH_SIZE);
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      const batchIds = targetIds.slice(
        batchIndex * BATCH_SIZE,
        (batchIndex + 1) * BATCH_SIZE,
      );
      log(
        `Batch ${batchIndex + 1}/${batchCount}: documents ${batchIds.join(', ')}`,
      );

      // The database's own clock, not this process's, so the completion
      // check below compares last_indexed_at against the same clock that
      // wrote it.
      const { batchStartedAt } = await sql<{ batchStartedAt: Date }>`
        SELECT now() AS "batchStartedAt"
      `
        .execute(db)
        .then((result) => result.rows[0]);

      for (const documentId of batchIds) {
        const deleted = await db
          .deleteFrom('document_block_hashes')
          .where('document_id', '=', documentId)
          .executeTakeFirst();
        await scheduler.onDocumentEdited(documentId);
        log(
          `  -> document ${documentId}: cleared ${deleted.numDeletedRows} hash row(s), job queued`,
        );
      }

      const remainingIds = new Set(batchIds);
      const deadline = Date.now() + BATCH_TIMEOUT_MS;
      while (remainingIds.size > 0 && Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        const finished = await db
          .selectFrom('documents')
          .select('id')
          .where('id', 'in', [...remainingIds])
          .where('indexing_status', '=', 'idle')
          .where('last_indexed_at', '>', batchStartedAt)
          .execute();
        for (const { id } of finished) {
          remainingIds.delete(id);
          log(`  <- document ${id} reindexed`);
        }
      }

      if (remainingIds.size > 0) {
        log(
          `Batch ${batchIndex + 1} timed out after ${BATCH_TIMEOUT_MS / 60000}min. ` +
            `Still not reindexed: ${[...remainingIds].join(', ')} — check indexing_status on these documents. Stopping.`,
        );
        return;
      }
    }

    log(
      `All ${targetIds.length} document(s) reindexed in ${Math.round((Date.now() - startedAt) / 1000)}s.`,
    );
  } finally {
    log('Closing application context...');
    await app.close();
    log(
      `Done. Total runtime: ${Math.round((Date.now() - startedAt) / 1000)}s.`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Reindex script failed:', err);
    process.exit(1);
  });
