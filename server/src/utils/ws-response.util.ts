import { INTERNAL_SERVER_ERROR_MESSAGE } from '../constants/constants';

export interface WsResponse<T = null> {
  success: boolean;
  data?: T;
  error?: string;
}

export function wsSuccess<T>(data?: T): WsResponse<T> {
  return { success: true, data };
}

export function wsError(message: string): WsResponse {
  return { success: false, error: message };
}

export function wsInternalServerError(): WsResponse {
  return { success: false, error: INTERNAL_SERVER_ERROR_MESSAGE };
}
