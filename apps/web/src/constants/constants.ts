// Interval in milliseconds between ping-pong latency checks.
export const PING_INTERVAL_MS = 5000;

// localStorage key for the CSRF state token stored before redirecting to Google and validated on callback.
export const AUTH_CSRF_STATE = "authCSRFState";

// localStorage key prefix for the per-document write-lock toggle, suffixed with the document ID.
export const WRITE_LOCK_STORAGE_PREFIX = "writeLocked:";
