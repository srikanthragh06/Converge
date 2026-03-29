// Consistent response envelope for all API endpoints.
// Every response, success or failure, shares this shape so clients
// can handle them uniformly without inspecting HTTP status codes alone.

import { INTERNAL_SERVER_ERROR_MESSAGE } from '../constants/constants';

export interface HttpResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export function httpOK<T>(data?: T): HttpResponse<T> {
  return { success: true, data };
}

export function httpFail(message: string): HttpResponse<never> {
  return { success: false, message };
}

export function httpInternalServerError(): HttpResponse<never> {
  return { success: false, message: INTERNAL_SERVER_ERROR_MESSAGE };
}
