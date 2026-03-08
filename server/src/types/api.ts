// API response types — keep in sync with web/src/types/api.ts (no shared package yet).
// All REST endpoints return ApiResponse<T>: either a success with typed data or a failure with an error string.

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// The authenticated user object returned in REST responses.
// Mirrors AuthedUser in types.ts but kept here for the REST layer.
export type AuthedUser = { id: number; email: string; displayName?: string; avatarUrl?: string };

// POST /auth/verifyGoogleAuth — issues JWT cookie and returns user profile.
export type VerifyGoogleAuthData = { user: AuthedUser };

// GET /auth/me — returns the decoded JWT payload for the current session.
export type MeData = { user: AuthedUser };

// GET /documents/:documentId — returns public document metadata (id + title).
// PATCH /documents/:documentId/title — updates the title, returns updated metadata.
export type DocumentMetaData = { id: number; title: string };
