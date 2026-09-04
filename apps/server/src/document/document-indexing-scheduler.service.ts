import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
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
 * while edits keep coming.
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
    // bookkeeping.
    await this.boss.createQueue(DocumentIndexingSchedulerService.IDLE_QUEUE, {
      policy: 'short',
    });

    await this.boss.work<IndexingJobData>(
      DocumentIndexingSchedulerService.IDLE_QUEUE,
      async ([job]) => {
        await this.documentIndexingService.reindexDocument(job.data.documentId);
      },
    );
  }

  /**
   * Called after every content-changing edit to a document. Resets the
   * idle re-indexing timer to fire again in IDLE_DELAY_SECONDS.
   * @param documentId - the document that was just edited
   */
  async onDocumentEdited(documentId: number): Promise<void> {
    // upsert always resets the pending job's startAfter (or creates one if
    // none is pending) — every edit pushes the fire time further out, so
    // this only actually runs once edits stop for a full
    // IDLE_DELAY_SECONDS straight.
    await this.boss.upsert(
      DocumentIndexingSchedulerService.IDLE_QUEUE,
      { documentId },
      {
        singletonKey: String(documentId),
        startAfter: DocumentIndexingSchedulerService.IDLE_DELAY_SECONDS,
      },
    );
  }
}
