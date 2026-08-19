// In-process lock, not a distributed/cross-instance one — see
// RedisService.acquireLock for that. This only serializes access within
// this single Node process. Built from chained Promises rather than an OS
// lock primitive: Node is single-threaded, so ordering calls is all that's
// needed to guarantee exclusivity, even if a call internally awaits/yields
// mid-execution.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs fn only once every previously queued call has finished (successfully
 * or not), then updates the queue so the next caller waits for this one.
 * Guarantees at most one fn passed to this function is ever running at a
 * time, process-wide.
 * @param fn - the async operation to run exclusively
 * @returns fn's result, once it's this call's turn and fn has completed
 */
export function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);

  // Normalized to always resolve so a rejection here can't surface as an
  // unhandled rejection on the queue variable itself — the real error
  // still reaches this call's own caller via `result`.
  queue = result.then(
    () => undefined,
    () => undefined,
  );

  return result;
}
