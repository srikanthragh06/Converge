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

// A single row in the document library — returned by GET /documents and GET /documents/search.
// lastEditedAt is null if the user has never made an edit to this document.
export type DocumentLibraryItem = {
    id: number;
    title: string;
    createdByName: string | null; // display_name of the creator; null for pre-v0.12 docs
    lastViewedAt: string;         // ISO 8601 timestamp
    lastEditedAt: string | null;  // ISO 8601 timestamp; null if user never edited
};

// GET /getUserViewedDocs — paginated with a compound cursor (lastViewedAt, lastId).
// nextCursor is null when there are no more pages. Pass both fields as query params
// (?lastViewedAt=<iso>&lastId=<id>) to fetch the next page.
export type DocumentLibraryData = {
    documents: DocumentLibraryItem[];
    nextCursor: { lastId: number; lastViewedAt: string } | null;
};

// GET /searchUserDocs — not paginated; returns all matching documents in one response.
export type DocumentSearchData = { documents: DocumentLibraryItem[] };
