// ControllerService: registers all Express REST routes.
// Delegates business logic to the appropriate services via servicesStore.
// requireAuth() is a private helper used at the top of every protected route —
// it reads the JWT cookie, verifies it, and returns the payload or null.

import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import { servicesStore } from "../store/servicesStore";
import {
    ApiResponse,
    VerifyGoogleAuthData,
    MeData,
    DocumentMetaData,
    DocumentLibraryData,
    DocumentSearchData,
    DocumentMembersData,
    DocumentUserSearchData,
} from "../types/api";
import { JWT_EXPIRES_IN, JWT_COOKIE_MAX_AGE_MS, hasAccess } from "../constants/constants";
import { JwtPayload } from "../types/types";
import { ValidationService } from "./ValidationService";

export class ControllerService {
    // Reads the "token" cookie and verifies it. Returns the decoded payload on success,
    // or null if the cookie is missing or the JWT is invalid/expired.
    // Call at the top of every protected route handler.
    private requireAuth(req: Request): JwtPayload | null {
        const token = (req.cookies as Record<string, string | undefined>)[
            "token"
        ];
        if (!token) return null;
        return servicesStore.authService.verifyJwt(token);
    }

    // Mounts all routes on the shared Express app. Called by App.start() before listen().
    registerRoutes(): void {
        const app = servicesStore.httpServerService.expressApp;

        // Parse cookies on all routes so req.cookies.token is available.
        app.use(cookieParser());

        // Parse JSON request bodies for all routes.
        app.use(express.json());

        // POST /auth/verifyGoogleAuth — verifies a Supabase access token from Google OAuth,
        // upserts the user into the DB, and issues a JWT in an httpOnly cookie.
        // Body: { accessToken: string }
        // Returns the user profile on success, 400/401 on failure.
        app.post(
            "/auth/verifyGoogleAuth",
            async (
                req: Request,
                res: Response<ApiResponse<VerifyGoogleAuthData>>,
            ) => {
                const { accessToken } = req.body as { accessToken?: string };

                if (!accessToken) {
                    res.status(401).json({
                        success: false,
                        error: "accessToken is required",
                    });
                    return;
                }

                // Verify the Supabase token and extract user metadata.
                const supabaseUser =
                    await servicesStore.authService.verifyToken(accessToken);

                if (!supabaseUser) {
                    res.status(401).json({
                        success: false,
                        error: "Invalid or expired Supabase token",
                    });
                    return;
                }

                // Pull display name and avatar from Supabase user_metadata (populated by Google OAuth).
                const displayName = supabaseUser.user_metadata?.full_name as
                    | string
                    | undefined;
                const avatarUrl = supabaseUser.user_metadata?.avatar_url as
                    | string
                    | undefined;

                // Upsert the user in the DB — creates on first login, updates profile on subsequent logins.
                const dbUser =
                    await servicesStore.persistenceService.upsertUser({
                        email: supabaseUser.email!,
                        displayName,
                        avatarUrl,
                    });

                // Issue a signed JWT and deliver it as an httpOnly cookie.
                const token = servicesStore.authService.signJwt(
                    {
                        id: dbUser.id,
                        email: dbUser.email,
                        displayName: dbUser.displayName,
                        avatarUrl: dbUser.avatarUrl,
                    },
                    JWT_EXPIRES_IN,
                );

                res.cookie("token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: JWT_COOKIE_MAX_AGE_MS,
                });

                res.json({ success: true, data: { user: dbUser } });
            },
        );

        // GET /auth/me — reads the JWT cookie and returns the current user's profile.
        // Returns 401 if no cookie is present, the JWT is invalid, or the user no longer
        // exists in the users table (e.g. account was deleted after the token was issued).
        app.get(
            "/auth/me",
            async (req: Request, res: Response<ApiResponse<MeData>>) => {
                const payload = this.requireAuth(req);

                if (!payload) {
                    res.status(401).json({
                        success: false,
                        error: "Not authenticated",
                    });
                    return;
                }

                // Confirm the user still exists in the DB — the JWT alone is not enough.
                const dbUser =
                    await servicesStore.persistenceService.getUserByEmail(
                        payload.email,
                    );

                if (!dbUser) {
                    res.status(401).json({
                        success: false,
                        error: "User not found",
                    });
                    return;
                }

                res.json({
                    success: true,
                    data: {
                        user: {
                            id: dbUser.id,
                            email: dbUser.email,
                            displayName: dbUser.displayName,
                            avatarUrl: dbUser.avatarUrl,
                        },
                    },
                });
            },
        );

        // POST /documents — creates a new document owned by the current user.
        // Returns the new document's id and empty title.
        // The client navigates to /note/:id after receiving the response.
        app.post(
            "/documents",
            async (
                req: Request,
                res: Response<ApiResponse<DocumentMetaData>>,
            ) => {
                const payload = this.requireAuth(req);
                if (!payload) {
                    res.status(401).json({
                        success: false,
                        error: "Not authenticated",
                    });
                    return;
                }

                const documentId = await servicesStore.persistenceService.createDoc(payload.id);
                res.status(201).json({ success: true, data: { id: documentId, title: "" } });
            },
        );

        // GET /getUserViewedDocs — paginated list of documents the current user has viewed.
        // Required: limit (integer, client-supplied page size).
        // Optional compound cursor: lastViewedAt (ISO timestamp) + lastId (integer).
        // Both cursor fields must be provided together; omitting both returns the first page.
        app.get(
            "/getUserViewedDocs",
            async (
                req: Request,
                res: Response<ApiResponse<DocumentLibraryData>>,
            ) => {
                const payload = this.requireAuth(req);
                if (!payload) {
                    res.status(401).json({ success: false, error: "Not authenticated" });
                    return;
                }

                const limit = parseInt(req.query["limit"] as string, 10);
                if (isNaN(limit) || limit < 1) {
                    res.status(400).json({ success: false, error: "limit must be a positive integer" });
                    return;
                }

                const lastViewedAt = req.query["lastViewedAt"] as string | undefined;
                const lastIdRaw = req.query["lastId"] as string | undefined;
                const lastId = lastIdRaw !== undefined ? parseInt(lastIdRaw, 10) : undefined;
                const cursor = lastViewedAt !== undefined && lastId !== undefined && !isNaN(lastId)
                    ? { lastViewedAt, lastId }
                    : undefined;

                const data = await servicesStore.persistenceService.getUserViewedDocs(payload.id, limit, cursor);
                res.json({ success: true, data });
            },
        );

        // GET /searchUserDocs?q=<query> — trigram similarity search on document titles,
        // scoped to documents the current user has viewed. Not paginated.
        app.get(
            "/searchUserDocs",
            async (
                req: Request,
                res: Response<ApiResponse<DocumentSearchData>>,
            ) => {
                const payload = this.requireAuth(req);
                if (!payload) {
                    res.status(401).json({ success: false, error: "Not authenticated" });
                    return;
                }

                const q = (req.query["q"] as string | undefined)?.trim() ?? "";
                const data = await servicesStore.persistenceService.searchUserViewedDocsByTitle(payload.id, q);
                res.json({ success: true, data });
            },
        );

        // GET /documents/:documentId — returns public metadata (id + title) for a document.
        // Returns 401 if unauthenticated, 400 if the id is invalid, 403 if no access, 404 if not found.
        app.get(
            "/documents/:documentId",
            async (
                req: Request,
                res: Response<ApiResponse<DocumentMetaData>>,
            ) => {
                const payload = this.requireAuth(req);
                if (!payload) {
                    res.status(401).json({ success: false, error: "Not authenticated" });
                    return;
                }

                const documentId = parseInt(req.params["documentId"] ?? "", 10);
                if (!Number.isInteger(documentId) || documentId < 1) {
                    res.status(400).json({ success: false, error: "Invalid documentId" });
                    return;
                }

                // Enforce viewer-level access before returning metadata.
                const access = await servicesStore.persistenceService.getDocumentAccess(documentId, payload.id);
                if (!access || !hasAccess(access, "viewer")) {
                    res.status(403).json({ success: false, error: "Forbidden" });
                    return;
                }

                try {
                    const meta =
                        await servicesStore.persistenceService.getDocumentMeta(
                            documentId,
                        );
                    res.json({ success: true, data: meta });
                } catch {
                    res.status(404).json({
                        success: false,
                        error: "Document not found",
                    });
                }
            },
        );

        // PATCH /documents/:documentId/title — overwrites the document title (last-writer-wins).
        // Requires editor access or above.
        app.patch(
            "/documents/:documentId/title",
            async (
                req: Request,
                res: Response<ApiResponse<DocumentMetaData>>,
            ) => {
                const payload = this.requireAuth(req);
                if (!payload) {
                    res.status(401).json({ success: false, error: "Not authenticated" });
                    return;
                }

                const documentId = parseInt(req.params["documentId"] ?? "", 10);
                if (!Number.isInteger(documentId) || documentId < 1) {
                    res.status(400).json({ success: false, error: "Invalid documentId" });
                    return;
                }

                // Enforce editor-level access before allowing title changes.
                const access = await servicesStore.persistenceService.getDocumentAccess(documentId, payload.id);
                if (!access || !hasAccess(access, "editor")) {
                    res.status(403).json({ success: false, error: "Forbidden" });
                    return;
                }

                const parsedTitle =
                    ValidationService.patchDocumentTitle.safeParse(req.body);
                if (!parsedTitle.success) {
                    res.status(400).json({
                        success: false,
                        error:
                            parsedTitle.error.issues[0]?.message ??
                            "Invalid request body",
                    });
                    return;
                }

                const { title } = parsedTitle.data;
                await servicesStore.persistenceService.updateDocumentTitle(
                    documentId,
                    title,
                );

                // Publish the new title to the Redis title channel so all servers
                // broadcast sync_title to their local clients in the document room.
                await servicesStore.docStoreService.publishTitleUpdate(
                    String(documentId),
                    title,
                );

                res.json({ success: true, data: { id: documentId, title } });
            },
        );

        // GET /documents/:documentId/access/members — paginated list of users with access.
        // Requires viewer access to see who else has access to the document.
        app.get(
            "/documents/:documentId/access/members",
            async (req: Request, res: Response<ApiResponse<DocumentMembersData>>) => {
                const payload = this.requireAuth(req);
                if (!payload) {
                    res.status(401).json({ success: false, error: "Not authenticated" });
                    return;
                }

                const documentId = parseInt(req.params["documentId"] ?? "", 10);
                if (!Number.isInteger(documentId) || documentId < 1) {
                    res.status(400).json({ success: false, error: "Invalid documentId" });
                    return;
                }

                const access = await servicesStore.persistenceService.getDocumentAccess(documentId, payload.id);
                if (!access || !hasAccess(access, "viewer")) {
                    res.status(403).json({ success: false, error: "Forbidden" });
                    return;
                }

                const limit = parseInt(req.query["limit"] as string ?? "20", 10);
                const cursorRaw = req.query["cursor"] as string | undefined;
                const cursor = cursorRaw !== undefined ? parseInt(cursorRaw, 10) : undefined;

                const data = await servicesStore.persistenceService.getDocumentMembers(
                    documentId,
                    isNaN(limit) || limit < 1 ? 20 : limit,
                    cursor !== undefined && !isNaN(cursor) ? cursor : undefined,
                );
                res.json({ success: true, data });
            },
        );

        // GET /documents/:documentId/access/users?q= — search users to invite (up to 5 results).
        // Requires admin or owner access — only they can grant access.
        app.get(
            "/documents/:documentId/access/users",
            async (req: Request, res: Response<ApiResponse<DocumentUserSearchData>>) => {
                const payload = this.requireAuth(req);
                if (!payload) {
                    res.status(401).json({ success: false, error: "Not authenticated" });
                    return;
                }

                const documentId = parseInt(req.params["documentId"] ?? "", 10);
                if (!Number.isInteger(documentId) || documentId < 1) {
                    res.status(400).json({ success: false, error: "Invalid documentId" });
                    return;
                }

                const access = await servicesStore.persistenceService.getDocumentAccess(documentId, payload.id);
                if (!access || !hasAccess(access, "admin")) {
                    res.status(403).json({ success: false, error: "Forbidden" });
                    return;
                }

                const q = ((req.query["q"] as string | undefined) ?? "").trim();
                if (q.length === 0) {
                    res.json({ success: true, data: { users: [] } });
                    return;
                }

                const data = await servicesStore.persistenceService.searchUsersForDoc(documentId, q, 5);
                res.json({ success: true, data });
            },
        );

        // PUT /documents/:documentId/access — grant or update a user's access level.
        // Requires admin or owner access. The owner's own role cannot be changed.
        // Body: { userId: number, accessLevel: 'owner'|'admin'|'editor'|'viewer' }
        app.put(
            "/documents/:documentId/access",
            async (req: Request, res: Response<ApiResponse<{ ok: boolean }>>) => {
                const payload = this.requireAuth(req);
                if (!payload) {
                    res.status(401).json({ success: false, error: "Not authenticated" });
                    return;
                }

                const documentId = parseInt(req.params["documentId"] ?? "", 10);
                if (!Number.isInteger(documentId) || documentId < 1) {
                    res.status(400).json({ success: false, error: "Invalid documentId" });
                    return;
                }

                const callerAccess = await servicesStore.persistenceService.getDocumentAccess(documentId, payload.id);
                if (!callerAccess || !hasAccess(callerAccess, "admin")) {
                    res.status(403).json({ success: false, error: "Forbidden" });
                    return;
                }

                const parsed = ValidationService.upsertDocumentAccess.safeParse(req.body);
                if (!parsed.success) {
                    res.status(400).json({
                        success: false,
                        error: parsed.error.issues[0]?.message ?? "Invalid request body",
                    });
                    return;
                }

                const { userId, accessLevel } = parsed.data;

                // Prevent changing the owner's role — ownership is permanent.
                const targetAccess = await servicesStore.persistenceService.getDocumentAccess(documentId, userId);
                if (targetAccess === "owner") {
                    res.status(403).json({ success: false, error: "Cannot change the owner's role" });
                    return;
                }

                await servicesStore.persistenceService.upsertDocumentAccess(documentId, userId, accessLevel);
                res.json({ success: true, data: { ok: true } });
            },
        );

        // DELETE /documents/:documentId/access/:userId — revoke a user's access.
        // Requires admin or owner access. The document owner cannot be removed.
        app.delete(
            "/documents/:documentId/access/:userId",
            async (req: Request, res: Response<ApiResponse<{ ok: boolean }>>) => {
                const payload = this.requireAuth(req);
                if (!payload) {
                    res.status(401).json({ success: false, error: "Not authenticated" });
                    return;
                }

                const documentId = parseInt(req.params["documentId"] ?? "", 10);
                const targetUserId = parseInt(req.params["userId"] ?? "", 10);
                if (!Number.isInteger(documentId) || documentId < 1 ||
                    !Number.isInteger(targetUserId) || targetUserId < 1) {
                    res.status(400).json({ success: false, error: "Invalid documentId or userId" });
                    return;
                }

                const callerAccess = await servicesStore.persistenceService.getDocumentAccess(documentId, payload.id);
                if (!callerAccess || !hasAccess(callerAccess, "admin")) {
                    res.status(403).json({ success: false, error: "Forbidden" });
                    return;
                }

                // Prevent removing the owner — at least one owner must remain.
                const targetAccess = await servicesStore.persistenceService.getDocumentAccess(documentId, targetUserId);
                if (targetAccess === "owner") {
                    res.status(403).json({ success: false, error: "Cannot remove the document owner" });
                    return;
                }

                await servicesStore.persistenceService.removeDocumentAccess(documentId, targetUserId);
                res.json({ success: true, data: { ok: true } });
            },
        );
    }
}
