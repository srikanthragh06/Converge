// Consistent response envelope for all API endpoints.
// Every response, success or failure, shares this shape so clients
// can handle them uniformly without inspecting HTTP status codes alone.

import { INTERNAL_SERVER_ERROR_MESSAGE } from '@converge/shared';

export interface HttpResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Returns a success response envelope, optionally including a data payload.
 * @param data - optional payload to include in the response
 */
export function httpOK<T>(data?: T): HttpResponse<T> {
  return { success: true, data };
}

/**
 * Returns a failure response envelope with a human-readable reason.
 * @param message - description of why the request failed
 */
export function httpFail(message: string): HttpResponse<never> {
  return { success: false, message };
}

/**
 * Returns a generic internal server error envelope with a safe,
 * non-leaking message suitable for sending to clients.
 */
export function httpInternalServerError(): HttpResponse<never> {
  return { success: false, message: INTERNAL_SERVER_ERROR_MESSAGE };
}
