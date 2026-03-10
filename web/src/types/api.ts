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

// GET /documents/:documentId
// PATCH /documents/:documentId/title
export type DocumentMetaData = { id: number; title: string };

// A single row in the document library — returned by GET /documents and GET /documents/search.
// lastEditedAt is null if the user has never made an edit to this document.
export type DocumentLibraryItem = {
    id: number;
    title: string;
    createdByName: string | null; // display_name of the creator; null for pre-v0.12 docs
    lastViewedAt: string;         // ISO 8601 timestamp
    lastEditedAt: string | null;  // ISO 8601 timestamp; null if user never edited
};

// GET /documents — list of docs the current user has viewed, most recent first.
// GET /documents/search?q=... — same shape, ordered by trigram similarity score.
export type DocumentLibraryData = { documents: DocumentLibraryItem[] };
