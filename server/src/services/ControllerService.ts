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
} from "../types/api";
import { JWT_EXPIRES_IN, JWT_COOKIE_MAX_AGE_MS } from "../constants/constants";
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

        // GET /documents/:documentId — returns public metadata (id + title) for a document.
        // Returns 401 if unauthenticated, 400 if the id is invalid, 404 if not found.
        app.get(
            "/documents/:documentId",
            async (
                req: Request,
                res: Response<ApiResponse<DocumentMetaData>>,
            ) => {
                if (!this.requireAuth(req)) {
                    res.status(401).json({
                        success: false,
                        error: "Not authenticated",
                    });
                    return;
                }

                const documentId = parseInt(req.params["documentId"] ?? "", 10);
                if (!Number.isInteger(documentId) || documentId < 1) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid documentId",
                    });
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
        f;
        // PATCH /documents/:documentId/title — overwrites the document title (last-writer-wins).
        // Requires a valid JWT cookie. Body: { title: string }.
        app.patch(
            "/documents/:documentId/title",
            async (
                req: Request,
                res: Response<ApiResponse<DocumentMetaData>>,
            ) => {
                if (!this.requireAuth(req)) {
                    res.status(401).json({
                        success: false,
                        error: "Not authenticated",
                    });
                    return;
                }

                const documentId = parseInt(req.params["documentId"] ?? "", 10);
                if (!Number.isInteger(documentId) || documentId < 1) {
                    res.status(400).json({
                        success: false,
                        error: "Invalid documentId",
                    });
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

                // Broadcast the new title to all clients currently in the document room
                // so they update in real time without needing a page reload.
                servicesStore.httpServerService.io
                    .to(String(documentId))
                    .emit("sync_title", title);

                res.json({ success: true, data: { id: documentId, title } });
            },
        );
    }
}
