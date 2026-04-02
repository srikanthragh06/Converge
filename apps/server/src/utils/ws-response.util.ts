// Consistent response envelope for all WebSocket events.
// Distinguishes success from failure by the presence of `error`, rather than a boolean flag.

import { INTERNAL_SERVER_ERROR_MESSAGE } from '@converge/shared';

// Presence of `error` indicates failure; absence indicates success.
// `success: boolean` is intentionally omitted — the client discriminates by checking `error !== undefined`.
export interface WsResponse<T = null> {
  data?: T;
  error?: string;
}

/**
 * Returns a success WebSocket response envelope, optionally including a data payload.
 * @param data - optional payload to include in the response
 */
export function wsSuccess<T>(data?: T): WsResponse<T> {
  return { data };
}

/**
 * Returns a failure WebSocket response envelope with a human-readable error message.
 * @param message - description of why the event failed
 */
export function wsError(message: string): WsResponse {
  return { error: message };
}

/**
 * Returns a generic internal server error WebSocket envelope with a safe,
 * non-leaking message suitable for sending to clients.
 */
export function wsInternalServerError(): WsResponse {
  return { error: INTERNAL_SERVER_ERROR_MESSAGE };
}
