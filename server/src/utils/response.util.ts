// Consistent response envelope for all API endpoints.
// Every response, success or failure, shares this shape so clients
// can handle them uniformly without inspecting HTTP status codes alone.
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export function ok<T>(data?: T): ApiResponse<T> {
  return { success: true, data };
}

// `never` for data signals that error responses never carry a data payload.
export function fail(message: string): ApiResponse<never> {
  return { success: false, message };
}
