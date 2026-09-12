import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import { DatabaseService } from '../db/database.service.js';
import { DocumentIndexingService } from './document-indexing.service.js';

/** Payload carried by the indexing job. */
interface IndexingJobData {
  documentId: number;
}

/**
 * Schedules automatic RAG re-indexing via pg-boss. A single per-document
 * idle timer that resets on every edit and fires IDLE_DELAY_SECONDS after
 * the last one — deliberately its own, separate, shorter timer rather than
 * piggybacking on DocumentCheckpointSchedulerService's idle queue (90s is
 * too coarse for search freshness), and unlike that service, no interval
 * twin: re-indexing is cheap enough per run (only the changed neighborhood
 * gets re-embedded) that there's no need to also fire on a fixed cadence
 * while edits keep coming. Also owns the documents.indexing_status
 * lifecycle ('pending' when a run is scheduled, 'indexing' while one is
 * actually running) — DocumentIndexingService.reindexDocument itself only
 * ever resets it to 'idle' and stamps last_indexed_at, on its own successful
 * completion, so a status read never depends on this scheduler having run
 * cleanly to be accurate about a finished reindex.
 */
@Injectable()
export class DocumentIndexingSchedulerService {
  private readonly boss: PgBoss; // the pg-boss client, connected to the same Postgres database as the app

  /** Queue name for the idle-triggered indexing job. */
  private static readonly IDLE_QUEUE = 'document-indexing-idle';

  /** Seconds of inactivity after the last edit before a re-index fires. */
  private static readonly IDLE_DELAY_SECONDS = 5;

  constructor(
    private readonly configService: ConfigService,
    private readonly documentIndexingService: DocumentIndexingService,
    private readonly dbService: DatabaseService,
  ) {
    const environment = this.configService.getOrThrow<string>('ENVIRONMENT');

    if (environment === 'DEV') {
      // DEV connects to the local docker-compose postgres container.
      this.boss = new PgBoss({
        host: this.configService.getOrThrow<string>('POSTGRES_DEV_HOST'),
        port: this.configService.getOrThrow<number>('POSTGRES_DEV_PORT'),
        user: this.configService.getOrThrow<string>('POSTGRES_DEV_USERNAME'),
        password: this.configService.getOrThrow<string>(
          'POSTGRES_DEV_PASSWORD',
        ),
        database: this.configService.getOrThrow<string>('POSTGRES_DEV_DBNAME'),
      });
    } else if (environment === 'PROD') {
      // PROD connects to the production database.
      this.boss = new PgBoss({
        host: this.configService.getOrThrow<string>('POSTGRES_PROD_HOST'),
        user: this.configService.getOrThrow<string>('POSTGRES_PROD_USERNAME'),
        password: this.configService.getOrThrow<string>(
          'POSTGRES_PROD_PASSWORD',
        ),
        database: this.configService.getOrThrow<string>('POSTGRES_PROD_DBNAME'),
        // rejectUnauthorized: false skips CA chain verification — required for
        // Supabase, matching DatabaseService's connection for the same reason.
        ssl: { rejectUnauthorized: false },
      });
    } else {
      throw new Error(`Unknown ENVIRONMENT "${environment}"`);
    }

    this.boss.on('error', (err) => console.error('pg-boss error:', err));
  }

  /**
   * Starts pg-boss, creates the indexing queue if it doesn't already
   * exist, and registers its job handler. Must be called once at
   * application bootstrap, after the database is reachable and migrated,
   * before any document edits can be processed.
   */
  async start(): Promise<void> {
    await this.boss.start();

    // 'short' policy: at most one pending (created/retry) job per
    // singletonKey — what lets onDocumentEdited below reset this timer
    // using pg-boss's own conflict handling rather than hand-rolled
    // bookkeeping. retryLimit/retryDelay/retryBackoff override pg-boss's
    // default of an immediate (0-delay) retry — reindexDocument's embed()
    // calls can fail on a transient, expected condition (the shared OpenAI
    // rate-limit window being full), and retrying instantly just re-hits
    // the same still-full window. Backoff from 15s gives that window time
    // to clear before each attempt.
    await this.boss.createQueue(DocumentIndexingSchedulerService.IDLE_QUEUE, {
      policy: 'short',
      retryLimit: 5,
      retryDelay: 15,
      retryBackoff: true,
    });

    await this.boss.work<IndexingJobData>(
      DocumentIndexingSchedulerService.IDLE_QUEUE,
      async ([job]) => {
        const { documentId } = job.data;
        // Mark 'indexing' before the run starts so a concurrent status read
        // sees it as in-progress rather than still 'pending'. pg-boss
        // already catches a handler rejection itself to record the job as
        // failed (applying its own retry/backoff policy) — this try-catch
        // isn't guarding against a process crash, it exists so a failed run
        // doesn't leave indexing_status permanently stuck at 'indexing'.
        try {
          await this.dbService.kysely
            .updateTable('documents')
            .set({ indexing_status: 'indexing' })
            .where('id', '=', documentId)
            .execute();
          await this.documentIndexingService.reindexDocument(documentId);
        } catch (err) {
          // reindexDocument's own transaction never committed, so
          // last_indexed_at correctly stays unchanged — only reset the
          // status here, back to idle, so a crashed run doesn't strand the
          // document permanently showing 'indexing'. Rethrown so pg-boss
          // still records the job as failed (its own retry/backoff policy).
          console.error(
            `Indexing job failed for document ${documentId}:`,
            err,
          );
          await this.dbService.kysely
            .updateTable('documents')
            .set({ indexing_status: 'idle' })
            .where('id', '=', documentId)
            .execute();
          throw err;
        }
      },
    );
  }

  /**
   * Called after every content-changing edit to a document. Resets the
   * idle re-indexing timer to fire again in IDLE_DELAY_SECONDS, and marks
   * the document 'pending' so a status read reflects the queued run even
   * before it actually starts.
   * @param documentId - the document that was just edited
   */
  async onDocumentEdited(documentId: number): Promise<void> {
    // upsert always resets the pending job's startAfter (or creates one if
    // none is pending) — every edit pushes the fire time further out, so
    // this only actually runs once edits stop for a full
    // IDLE_DELAY_SECONDS straight. Scheduled before the status write below
    // (not after) so a failure between the two calls can only ever leave a
    // job scheduled with a stale status — self-healing, since that job will
    // still run and correct the status itself — rather than a status stuck
    // at 'pending' with no job ever scheduled to move it past that.
    await this.boss.upsert(
      DocumentIndexingSchedulerService.IDLE_QUEUE,
      { documentId },
      {
        singletonKey: String(documentId),
        startAfter: DocumentIndexingSchedulerService.IDLE_DELAY_SECONDS,
      },
    );

    await this.dbService.kysely
      .updateTable('documents')
      .set({ indexing_status: 'pending' })
      .where('id', '=', documentId)
      .execute();
  }
}
