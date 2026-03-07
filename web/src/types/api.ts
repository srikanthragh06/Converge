// API response types — keep in sync with server/src/types/api.ts (no shared package yet).
// All REST endpoints return ApiResponse<T>: either a success with typed data or a failure with an error string.

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// The authenticated user object returned in REST responses and stored in Jotai.
export type AuthedUser = { id: number; email: string; displayName?: string; avatarUrl?: string };

// POST /auth/verifyGoogleAuth
export type VerifyGoogleAuthData = { user: AuthedUser };

// GET /auth/me
export type MeData = { user: AuthedUser };
