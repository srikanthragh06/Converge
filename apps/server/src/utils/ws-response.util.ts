// Consistent response envelope for all WebSocket events.
// Mirrors the HTTP response util so clients can handle both transports uniformly.

import { INTERNAL_SERVER_ERROR_MESSAGE } from '../constants/constants';

export interface WsResponse<T = null> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Returns a success WebSocket response envelope, optionally including a data payload.
 * @param data - optional payload to include in the response
 */
export function wsSuccess<T>(data?: T): WsResponse<T> {
  return { success: true, data };
}

/**
 * Returns a failure WebSocket response envelope with a human-readable error message.
 * @param message - description of why the event failed
 */
export function wsError(message: string): WsResponse {
  return { success: false, error: message };
}

/**
 * Returns a generic internal server error WebSocket envelope with a safe,
 * non-leaking message suitable for sending to clients.
 */
export function wsInternalServerError(): WsResponse {
  return { success: false, error: INTERNAL_SERVER_ERROR_MESSAGE };
}
