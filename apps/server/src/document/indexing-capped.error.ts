/**
 * Thrown by DocumentIndexingService.reindexDocument when it deliberately
 * stops partway through a run after hitting MAX_CHUNKS_PER_RUN (or a real
 * embed rate-limit rejection cuts it short), rather than embedding the
 * entire rebuild set in one pass. Not a failure —
 * DocumentIndexingSchedulerService catches this the same way it catches a
 * genuine error (so pg-boss's existing retry/backoff reschedules the
 * remainder), but must not log it as one.
 */
export class IndexingCappedError extends Error {
  /**
   * @param documentId - the document whose reindex run stopped early
   */
  constructor(documentId: number) {
    super(
      `Reindex of document ${documentId} hit the per-run chunk cap; remainder deferred to a follow-up run.`,
    );
    this.name = 'IndexingCappedError';
  }
}
