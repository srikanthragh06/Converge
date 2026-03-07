// API response types — keep in sync with web/src/types/api.ts (no shared package yet).
// All REST endpoints return ApiResponse<T>: either a success with typed data or a failure with an error string.

import { User } from "@supabase/supabase-js";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// POST /auth/verify
export type VerifyTokenData = { user: User };
