import * as Y from 'yjs';

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

/**
 * Encodes a Uint8Array to a base64 string for safe transmission over JSON.
 * @param data - the binary data to encode
 * @returns the base64-encoded string
 */
export const uint8ArrayToBase64 = (data: Uint8Array): string => {
  return Buffer.from(data).toString('base64');
};

/**
 * Decodes a base64 string back to a Uint8Array.
 * @param base64 - the base64-encoded string to decode
 * @returns the original binary data
 */
export const base64ToUint8Array = (base64: string): Uint8Array => {
  return new Uint8Array(Buffer.from(base64, 'base64'));
};

/**
 * Returns true if a Yjs update carries no actual content changes (no structs
 * — insertions, formatting, deletions-as-content). Checking raw byte length
 * is not reliable here: `Y.encodeStateAsUpdate` always appends the doc's
 * FULL delete set regardless of the target state vector passed in — delete-set
 * filtering isn't state-vector-based — so a diff computed against an
 * already-fully-synced state vector is never truly empty once the document
 * has any history of deletions; it still carries the (already-known) delete
 * set as bytes. `Y.decodeUpdate` parses the update properly and exposes its
 * struct list directly, which is what's actually relevant here. Safe to
 * treat a structs-empty update as a no-op for skip-persist/broadcast/attribute
 * purposes: any real deletion was already captured once, at the update that
 * first produced it.
 * @param update - encoded Yjs update bytes to check
 * @returns true if the update contains no structs
 */
export const isEmptyYjsUpdate = (update: Uint8Array): boolean => {
  return Y.decodeUpdate(update).structs.length === 0;
};
