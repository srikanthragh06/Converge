// Resolves after ms milliseconds. Used in retry loops (e.g. waitForDb) to
// pause between connection attempts without blocking the event loop.
export const sleep = (ms: number): Promise<void> => {
  return new Promise((r) => setTimeout(r, ms));
};
