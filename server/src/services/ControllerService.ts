// ControllerService: registers all Express REST routes.
// Delegates business logic to the appropriate services via servicesStore.

import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import { servicesStore } from "../store/servicesStore";
import { ApiResponse, VerifyGoogleAuthData, MeData } from "../types/api";
import { JWT_EXPIRES_IN, JWT_COOKIE_MAX_AGE_MS } from "../constants/constants";

export class ControllerService {
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
        app.post("/auth/verifyGoogleAuth", async (req: Request, res: Response<ApiResponse<VerifyGoogleAuthData>>) => {
            const { accessToken } = req.body as { accessToken?: string };

            if (!accessToken) {
                res.status(400).json({ success: false, error: "accessToken is required" });
                return;
            }

            // Verify the Supabase token and extract user metadata.
            const supabaseUser = await servicesStore.authService.verifyToken(accessToken);

            if (!supabaseUser) {
                res.status(401).json({ success: false, error: "Invalid or expired Supabase token" });
                return;
            }

            // Pull display name and avatar from Supabase user_metadata (populated by Google OAuth).
            const displayName = supabaseUser.user_metadata?.full_name as string | undefined;
            const avatarUrl = supabaseUser.user_metadata?.avatar_url as string | undefined;

            // Upsert the user in the DB — creates on first login, updates profile on subsequent logins.
            const dbUser = await servicesStore.persistenceService.upsertUser({
                email: supabaseUser.email!,
                displayName,
                avatarUrl,
            });

            // Issue a signed JWT and deliver it as an httpOnly cookie.
            const token = servicesStore.authService.signJwt(
                { id: dbUser.id, email: dbUser.email, displayName: dbUser.displayName, avatarUrl: dbUser.avatarUrl },
                JWT_EXPIRES_IN,
            );

            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: JWT_COOKIE_MAX_AGE_MS,
            });

            res.json({ success: true, data: { user: dbUser } });
        });

        // GET /auth/me — reads the JWT cookie and returns the current user's profile.
        // Returns 401 if no cookie is present or the JWT is invalid or expired.
        app.get("/auth/me", (req: Request, res: Response<ApiResponse<MeData>>) => {
            const token = (req.cookies as Record<string, string | undefined>)["token"];

            if (!token) {
                res.status(401).json({ success: false, error: "Not authenticated" });
                return;
            }

            const payload = servicesStore.authService.verifyJwt(token);

            if (!payload) {
                res.status(401).json({ success: false, error: "Invalid or expired token" });
                return;
            }

            res.json({
                success: true,
                data: {
                    user: {
                        id: payload.id,
                        email: payload.email,
                        displayName: payload.displayName,
                        avatarUrl: payload.avatarUrl,
                    },
                },
            });
        });
    }
}
