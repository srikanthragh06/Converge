// API response types — keep in sync with server/src/types/api.ts (no shared package yet).
// All REST endpoints return ApiResponse<T>: either a success with typed data or a failure with an error string.

import { AccessLevel } from "./types";

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
// accessLevel is the current user's role on this document.
export type DocumentLibraryItem = {
    id: number;
    title: string;
    createdByName: string | null; // display_name of the creator; null for pre-v0.12 docs
    lastViewedAt: string;         // ISO 8601 timestamp
    lastEditedAt: string | null;  // ISO 8601 timestamp; null if user never edited
    accessLevel: AccessLevel;     // current user's role on this document
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

// A member entry in the access list for a document.
export type DocumentMember = {
    userId: number;
    displayName: string | null;
    avatarUrl: string | null;
    accessLevel: AccessLevel;
};

// A user returned from the doc-scoped user search.
// accessLevel is null when the user has no access row for this document.
export type UserSearchResult = {
    id: number;
    displayName: string | null;
    avatarUrl: string | null;
    email: string;
    accessLevel: AccessLevel | null;
};

// GET /documents/:documentId/access/members — paginated list of document members.
export type DocumentMembersData = {
    members: DocumentMember[];
    nextCursor: number | null;
};

// GET /documents/:documentId/access/users?q= — user search results for share modal.
export type DocumentUserSearchData = { users: UserSearchResult[] };

// Re-export so other files can import AccessLevel from api.ts.
export type { AccessLevel };
