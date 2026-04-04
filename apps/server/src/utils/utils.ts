/**
 * Resolves after the given number of milliseconds. Used in retry loops to
 * pause between attempts without blocking the event loop.
 *
 * @param ms - Duration to wait in milliseconds.
 * @returns A Promise that resolves once the delay has elapsed.
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((r) => setTimeout(r, ms));
};
