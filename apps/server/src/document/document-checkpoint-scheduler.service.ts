import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import { DocumentCheckpointService } from './document-checkpoint.service';

/** Payload carried by both checkpoint job types. */
interface CheckpointJobData {
  documentId: number;
}

/**
 * Schedules automatic version-history checkpoints via pg-boss. Two
 * independent per-document timers: an idle timer that resets on every edit
 * and fires IDLE_DELAY_SECONDS after the last one, and an interval timer
 * that fires every INTERVAL_DELAY_SECONDS while edits keep coming and goes
 * dormant once a firing finds nothing new to checkpoint. Both queues use the
 * 'short' policy (at most one pending job per singletonKey), which is what
 * lets onDocumentEdited below reset the idle timer and start-if-absent the
 * interval timer using pg-boss's own conflict handling rather than
 * hand-rolled bookkeeping.
 */
@Injectable()
export class DocumentCheckpointSchedulerService {
  private readonly boss: PgBoss; // the pg-boss client, connected to the same Postgres database as the app

  /** Queue name for the idle-triggered checkpoint job. */
  private static readonly IDLE_QUEUE = 'document-checkpoint-idle';

  /** Queue name for the interval-triggered checkpoint job. */
  private static readonly INTERVAL_QUEUE = 'document-checkpoint-interval';

  /** Seconds of inactivity after the last edit before an idle checkpoint fires. */
  private static readonly IDLE_DELAY_SECONDS = 90;

  /** Seconds between interval checkpoints while a document keeps being edited. */
  private static readonly INTERVAL_DELAY_SECONDS = 360;

  constructor(
    private readonly configService: ConfigService,
    private readonly documentCheckpointService: DocumentCheckpointService,
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
   * Starts pg-boss, creates both checkpoint queues if they don't already
   * exist, and registers their job handlers. Must be called once at
   * application bootstrap, after the database is reachable, before any
   * document edits can be processed.
   */
  async start(): Promise<void> {
    await this.boss.start();

    // 'short' policy: at most one pending (created/retry) job per
    // singletonKey — the primitive both handlers below rely on.
    await this.boss.createQueue(DocumentCheckpointSchedulerService.IDLE_QUEUE, {
      policy: 'short',
    });
    await this.boss.createQueue(
      DocumentCheckpointSchedulerService.INTERVAL_QUEUE,
      { policy: 'short' },
    );

    // Idle firing: just take a checkpoint. It does not re-arm itself — the
    // next edit (if any) will schedule a fresh one via onDocumentEdited.
    await this.boss.work<CheckpointJobData>(
      DocumentCheckpointSchedulerService.IDLE_QUEUE,
      async ([job]) => {
        await this.documentCheckpointService.createCheckpointInternal(
          job.data.documentId,
        );
      },
    );

    // Interval firing: take a checkpoint, then only re-arm if that
    // checkpoint actually captured something new — otherwise the document
    // has gone idle and this timer should stop ticking until the next edit
    // restarts it.
    await this.boss.work<CheckpointJobData>(
      DocumentCheckpointSchedulerService.INTERVAL_QUEUE,
      async ([job]) => {
        const { documentId } = job.data;
        const result =
          await this.documentCheckpointService.createCheckpointInternal(
            documentId,
          );
        if (result.created) {
          await this.boss.send(
            DocumentCheckpointSchedulerService.INTERVAL_QUEUE,
            { documentId },
            {
              singletonKey: String(documentId),
              startAfter:
                DocumentCheckpointSchedulerService.INTERVAL_DELAY_SECONDS,
            },
          );
        }
      },
    );
  }

  /**
   * Called after every content-changing edit to a document. Resets the idle
   * checkpoint timer to fire again in IDLE_DELAY_SECONDS, and starts the
   * interval checkpoint timer if it isn't already running.
   * @param documentId - the document that was just edited
   */
  async onDocumentEdited(documentId: number): Promise<void> {
    // upsert always resets the pending idle job's startAfter (or creates one
    // if none is pending) — this is what makes it an *idle* timer rather
    // than a fixed one.
    await this.boss.upsert(
      DocumentCheckpointSchedulerService.IDLE_QUEUE,
      { documentId },
      {
        singletonKey: String(documentId),
        startAfter: DocumentCheckpointSchedulerService.IDLE_DELAY_SECONDS,
      },
    );

    // send() silently no-ops if a job with this singletonKey is already
    // pending (the 'short' policy enforces at most one), so this only starts
    // a fresh interval countdown when none is currently running — it never
    // pushes an already-ticking one back, unlike the idle timer above.
    await this.boss.send(
      DocumentCheckpointSchedulerService.INTERVAL_QUEUE,
      { documentId },
      {
        singletonKey: String(documentId),
        startAfter: DocumentCheckpointSchedulerService.INTERVAL_DELAY_SECONDS,
      },
    );
  }
}
