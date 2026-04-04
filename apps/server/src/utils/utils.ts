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
