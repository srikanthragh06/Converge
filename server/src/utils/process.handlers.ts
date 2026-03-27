export function registerProcessHandlers() {
  // Fires when a Promise is rejected and no .catch() handler is attached.
  // The process is not necessarily corrupted, so we log and continue.
  process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
  });

  // Fires when a synchronous exception is thrown outside of any try/catch.
  // At this point the process may be in a corrupted state — log and exit immediately.
  // The process manager (PM2, Docker, etc.) is responsible for restarting the server.
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
  });
}
