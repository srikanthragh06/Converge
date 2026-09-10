/**
 * THROWAWAY one-time script. Delete after running.
 *
 * Backfills RAG indexing for every existing document that predates the
 * indexing feature (identified by last_indexed_at IS NULL) — no new
 * indexing logic; it just drives every target document through the exact
 * same DocumentIndexingSchedulerService.onDocumentEdited() entry point a
 * live edit uses, then waits for the resulting pg-boss jobs to drain.
 *
 * Usage (run from apps/server):
 *   NODE_ENV=dev  npx ts-node --esm src/scripts/backfill-rag-index.ts          # dry run against dev
 *   NODE_ENV=dev  npx ts-node --esm src/scripts/backfill-rag-index.ts --run    # actually index, dev
 *   NODE_ENV=prod npx ts-node --esm src/scripts/backfill-rag-index.ts --run    # actually index, prod
 *
 * Without --run, it only prints which documents would be targeted.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { loadEnv } from '../utils/env.loader.js';
import { DatabaseService } from '../db/database.service.js';
import { DocumentIndexingSchedulerService } from '../document/document-indexing-scheduler.service.js';
import { sleep } from '../utils/utils.js';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — generous for <=100 documents

/** console.log with an HH:MM:SS timestamp prefix, so a long-running poll loop is easy to read back. */
function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function main() {
  const startedAt = Date.now();
  loadEnv();
  const dryRun = !process.argv.includes('--run');

  log(`Target environment: ${process.env.ENVIRONMENT}`);
  log(dryRun ? 'Mode: DRY RUN (pass --run to actually index)' : 'Mode: RUN');

  log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  log('Application context ready.');

  try {
    const dbService = app.get(DatabaseService);
    log('Verifying database connection...');
    await dbService.verifyDBConnection();
    log('Database connection verified.');

    log('Querying for non-deleted documents with last_indexed_at IS NULL...');
    const targets = await dbService.kysely
      .selectFrom('documents')
      .select('id')
      .where('is_deleted', '=', false)
      .where('last_indexed_at', 'is', null)
      .execute();

    log(
      `Found ${targets.length} never-indexed document(s): ${targets.map((t) => t.id).join(', ') || '(none)'}`,
    );

    if (dryRun) {
      log('Dry run complete — no changes made. Re-run with --run to index.');
      return;
    }
    if (targets.length === 0) {
      log('Nothing to do — every document is already indexed.');
      return;
    }

    const scheduler = app.get(DocumentIndexingSchedulerService);
    log('Starting indexing scheduler (pg-boss)...');
    // Registers the pg-boss queue/worker in this process, so this script
    // both enqueues and processes the backfill jobs itself.
    await scheduler.start();
    log('Indexing scheduler started — this process is now a pg-boss worker.');

    log(`Enqueuing ${targets.length} document(s)...`);
    for (const { id } of targets) {
      await scheduler.onDocumentEdited(id);
      log(`  -> enqueued document ${id}`);
    }
    log(
      'All documents enqueued. Each waits out a 5s idle window before its job actually runs.',
    );

    const targetIds = targets.map((t) => t.id);
    let remainingIds = new Set(targetIds);
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let pollCount = 0;

    log(
      `Polling every ${POLL_INTERVAL_MS / 1000}s for completion (timeout ${POLL_TIMEOUT_MS / 60000}min)...`,
    );

    while (Date.now() < deadline) {
      pollCount++;
      const remaining = await dbService.kysely
        .selectFrom('documents')
        .select('id')
        .where('id', 'in', targetIds)
        .where('last_indexed_at', 'is', null)
        .execute();

      const stillRemainingIds = new Set(remaining.map((r) => r.id));
      const justFinished = [...remainingIds].filter(
        (id) => !stillRemainingIds.has(id),
      );
      for (const id of justFinished) {
        log(`  <- document ${id} finished indexing`);
      }
      remainingIds = stillRemainingIds;

      if (remainingIds.size === 0) {
        log(
          `All ${targets.length} document(s) indexed in ${Math.round((Date.now() - startedAt) / 1000)}s.`,
        );
        return;
      }

      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      log(
        `[poll #${pollCount}, ${elapsedSec}s elapsed] Still waiting on ${remainingIds.size}/${targets.length}: ${[...remainingIds].join(', ')}`,
      );
      await sleep(POLL_INTERVAL_MS);
    }

    log(
      `Timed out after ${Math.round((Date.now() - startedAt) / 1000)}s waiting for backfill to finish. ` +
        `Still un-indexed: ${[...remainingIds].join(', ')} — check indexing_status on these documents.`,
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
    console.error('Backfill script failed:', err);
    process.exit(1);
  });
